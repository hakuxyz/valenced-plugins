import { getModules } from '@valenced/modules/finders'
import {
	createFilterGenerator,
	FilterScopes,
} from '@valenced/modules/finders/filters'
import { afterJSX } from '@valenced/react/jsx-runtime'
import { cloneElement } from 'react'
import type { AnyFunction } from '@valenced/utils/types'
import type { ReactElement } from 'react'

type Cleanup = (...fns: Array<() => unknown>) => void

const LIST_COMPONENT = 'EmojiPickerListComponent'
const TOP_HEADER = /^top emoji/i

const patched = new WeakSet<AnyFunction>()

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

function isPlain(value: unknown): value is Record<string, unknown> {
	if (!isRecord(value) || '$$typeof' in value) return false
	const proto = Object.getPrototypeOf(value)
	return proto === Object.prototype || proto === null
}

function findComponent(value: unknown, depth = 0): AnyFunction | undefined {
	if (depth > 2) return
	if (typeof value === 'function') {
		const fn = value as AnyFunction
		return fn.name === LIST_COMPONENT ? fn : undefined
	}
	if (!isPlain(value)) return
	for (const item of Object.values(value)) {
		const found = findComponent(item, depth + 1)
		if (found) return found
	}
}

function isTopHeader(value: unknown): boolean {
	return (
		isPlain(value) &&
		value.type === 1 &&
		typeof value.title === 'string' &&
		TOP_HEADER.test(value.title)
	)
}

function cleanData(value: unknown): unknown {
	if (
		!isPlain(value) ||
		!Array.isArray(value.data) ||
		!Array.isArray(value.headerIndices)
	) {
		return value
	}

	const removed = new Set<number>()
	for (let i = 0; i < value.data.length; i++) {
		if (!isTopHeader(value.data[i])) continue
		removed.add(i)
		for (let j = i + 1; j < value.data.length; j++) {
			if (isPlain(value.data[j]) && value.data[j].type === 1) break
			removed.add(j)
		}
	}
	if (!removed.size) return value

	const indexMap = new Map<number, number>()
	let nextIndex = 0
	for (let i = 0; i < value.data.length; i++) {
		if (!removed.has(i)) indexMap.set(i, nextIndex++)
	}

	return {
		...value,
		data: value.data.filter((_, i) => !removed.has(i)),
		headerIndices: value.headerIndices
			.map(index => indexMap.get(Number(index)))
			.filter((index): index is number => index !== undefined),
	}
}

const listComponentFilter = createFilterGenerator<[]>(
	(_args, _id, exports) => {
		try {
			return Boolean(findComponent(exports))
		} catch {
			return false
		}
	},
	() => 'noTopEmojis.listComponent',
	FilterScopes.Initialized,
)

function patchComponent(fn: AnyFunction, cleanup: Cleanup): void {
	if (patched.has(fn)) return
	patched.add(fn)

	const unpatch = afterJSX(fn as never, element => {
		try {
			const el = element as ReactElement<Record<string, unknown>>
			const props = el.props ?? {}
			const data = cleanData(props.data)
			if (data === props.data) return element as never
			return cloneElement(el, { ...props, data }) as never
		} catch {
			return element as never
		}
	})

	cleanup(() => unpatch())
}

export default plugin({
	start({ cleanup }) {
		cleanup(
			getModules(
				listComponentFilter(),
				exports => {
					try {
						const fn = findComponent(exports)
						if (fn) patchComponent(fn, cleanup)
					} catch {}
				},
				{ returnNamespace: true },
			),
		)
	},
})
