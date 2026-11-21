import { Dispatcher } from '@valenced/discord/common/flux'
import { onFluxEventDispatched } from '@valenced/discord/flux'
import { emojiKey, ReactionType, reactionKey } from './shared'
import type {
	LoggedReaction,
	ReactionAction,
	ReactionData,
	ReactionEmoji,
} from './shared'

// Every reaction we've seen for a message, so we can restore it if Discord removes it.
const known = new Map<string, Map<string, ReactionData>>()

// Deleted reactions we still want to show, grouped by message.
const logs = new Map<string, Map<string, LoggedReaction>>()

// Channel IDs, so we can force Discord to rebuild a row when we need to.
const channels = new Map<string, string>()

// Messages we're refreshing ourselves, to avoid logging our own updates.
const bypassed = new Set<string>()

export function getDeletedReactions(messageId: string): LoggedReaction[] {
	const map = logs.get(messageId)
	return map ? [...map.values()] : []
}

// Hold on to whatever Discord hands us before it can vanish.
export function recordMessage(
	messageId: string,
	channelId: string | undefined,
	reactions: ReactionData[],
): void {
	if (channelId) channels.set(messageId, channelId)

	let seen = known.get(messageId)
	if (!seen) known.set(messageId, (seen = new Map()))

	for (const reaction of reactions) {
		const normal = reaction.count ?? 0
		const burst = reaction.burstCount ?? reaction.burst_count ?? 0
		const key = `${messageId}:${emojiKey(reaction.emoji)}`

		// A zero count is often just a placeholder, so only keep the real ones.
		if (normal > 0)
			seen.set(
				reactionKey(messageId, reaction.emoji, ReactionType.Normal),
				reaction,
			)
		if (burst > 0)
			seen.set(
				reactionKey(messageId, reaction.emoji, ReactionType.Burst),
				reaction,
			)
		if (
			reaction.count === undefined &&
			reaction.burstCount === undefined &&
			reaction.burst_count === undefined
		) {
			seen.set(`${key}:${ReactionType.Normal}`, reaction)
			seen.set(`${key}:${ReactionType.Burst}`, reaction)
		}
	}
}

// If a reaction came back, stop treating it as deleted.
export function reconcile(messageId: string, reactions: ReactionData[]): void {
	const map = logs.get(messageId)
	if (!map?.size) return

	const current = new Set<string>()
	for (const reaction of reactions) {
		if ((reaction.count ?? 0) > 0)
			current.add(reactionKey(messageId, reaction.emoji, 0))
		if ((reaction.burstCount ?? reaction.burst_count ?? 0) > 0)
			current.add(reactionKey(messageId, reaction.emoji, 1))
	}

	for (const key of map.keys()) if (current.has(key)) map.delete(key)
	if (!map.size) logs.delete(messageId)
}

function remember(
	messageId: string,
	emoji: ReactionEmoji | undefined,
	type: number,
): boolean {
	if (!emoji) return false
	const key = reactionKey(messageId, emoji, type)
	const reaction = known.get(messageId)?.get(key)
	if (!reaction) return false

	let map = logs.get(messageId)
	if (!map) logs.set(messageId, (map = new Map()))
	map.set(key, { reaction: { ...reaction }, type, deletedAt: Date.now() })
	return true
}

function rerender(messageId: string): void {
	if (bypassed.has(messageId)) return
	const channelId = channels.get(messageId)
	if (!channelId) return

	// The store hasn't removed the reaction yet during this dispatch,
	// so wait a tick before forcing the row to rebuild.
	Promise.resolve().then(() => {
		if (bypassed.has(messageId)) return
		bypassed.add(messageId)
		try {
			Dispatcher.dispatch({
				type: 'MESSAGE_UPDATE',
				guildId: undefined,
				message: { id: messageId, channel_id: channelId },
			})
		} finally {
			bypassed.delete(messageId)
		}
	})
}

export function clearLogs(): void {
	known.clear()
	logs.clear()
	channels.clear()
	bypassed.clear()
}

export function interceptReactions() {
	return [
		onFluxEventDispatched<ReactionAction>(
			'MESSAGE_REACTION_REMOVE',
			payload => {
				if (!payload.messageId) return payload
				const type = payload.reactionType ?? 0
				if (remember(payload.messageId, payload.emoji, type))
					rerender(payload.messageId)
				return payload
			},
		),
		onFluxEventDispatched<ReactionAction>(
			'MESSAGE_REACTION_REMOVE_EMOJI',
			payload => {
				if (!payload.messageId) return payload
				let changed = remember(payload.messageId, payload.emoji, 0)
				changed = remember(payload.messageId, payload.emoji, 1) || changed
				if (changed) rerender(payload.messageId)
				return payload
			},
		),
		onFluxEventDispatched<ReactionAction>(
			'MESSAGE_REACTION_REMOVE_ALL',
			payload => {
				if (!payload.messageId) return payload
				const seen = known.get(payload.messageId)
				if (!seen) return payload

				let map = logs.get(payload.messageId)
				if (!map) logs.set(payload.messageId, (map = new Map()))
				for (const [key, reaction] of seen) {
					if (!map.has(key))
						map.set(key, {
							reaction: { ...reaction },
							type: key.endsWith(':1') ? 1 : 0,
							deletedAt: Date.now(),
						})
				}
				if (map.size) rerender(payload.messageId)
				return payload
			},
		),
	]
}
