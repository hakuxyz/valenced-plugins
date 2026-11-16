import { getStore } from '@valenced/discord/flux'
import { after } from '@valenced/patcher'
import SettingsComponent from './settings'
import { DefaultSettings, decodeColors } from './shared'
import type { Settings } from './shared'

interface UserProfile {
	bio?: string | null
	themeColors?: number[] | null
	premiumType?: number
	profileFetchFailed?: boolean
}

interface UserProfileStore {
	getUserProfile(userId: string): UserProfile | undefined
}

export default plugin<{ jsonStorage: Settings }>({
	jsonStorage: {
		load: true,
		default: DefaultSettings,
	},
	start({ cleanup, jsonStorage }) {
		cleanup(
			getStore<UserProfileStore>('UserProfileStore', store => {
				cleanup(
					after(store, 'getUserProfile', (profile: UserProfile | undefined) => {
						if (!profile || profile.profileFetchFailed) return profile

						try {
							const nitroFirst =
								jsonStorage.cache?.nitroFirst ?? DefaultSettings.nitroFirst
							if (nitroFirst && profile.themeColors != null) return profile

							const colors = decodeColors(profile.bio)
							if (!colors) return profile

							profile.themeColors = colors
							profile.premiumType = 2
						} catch {}

						return profile
					}),
				)
			}),
		)
	},
	SettingsComponent,
})
