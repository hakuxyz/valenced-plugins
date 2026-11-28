import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { zipSync } from 'fflate'

const PagesDir = 'build/pages'
const PacksDir = join(PagesDir, 'packs')
const ThemePacksDir = 'plugins/themes/packs'
const FixedMtime = new Date('2000-01-01T00:00:00Z')

rmSync(PagesDir, { recursive: true, force: true })
mkdirSync(PagesDir, { recursive: true })

let count = 0

function addAssets(
	dir: string,
	archive: Record<string, Uint8Array>,
	prefix = '',
) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name)
		if (entry.isDirectory()) addAssets(path, archive, `${prefix}${entry.name}/`)
		else archive[`${prefix}${entry.name}`] = new Uint8Array(readFileSync(path))
	}
}

for (const root of ['plugins', 'themes']) {
	for (const name of [...readdirSync(root)].sort()) {
		const pluginDir = join(root, name)
		const manifestPath = join(pluginDir, 'manifest.json')
		if (!existsSync(manifestPath)) continue

		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
			id: string
			version: string
		}
		const bundlePath = join(pluginDir, 'build', 'js', 'index.js')
		if (!existsSync(bundlePath)) {
			throw new Error(`Missing ${bundlePath}. Run "bun run build" first.`)
		}

		const files: Record<string, Uint8Array> = {
			'manifest.json': new Uint8Array(readFileSync(manifestPath)),
			'index.js': new Uint8Array(readFileSync(bundlePath)),
		}
		const assetsDir = join(pluginDir, 'assets')
		if (root === 'themes' && existsSync(assetsDir))
			addAssets(assetsDir, files, 'assets/')
		const archive = zipSync(files, { mtime: FixedMtime })
		const fileName = `${manifest.id}@${manifest.version}.zip`

		writeFileSync(join(PagesDir, fileName), archive)
		count++
		console.log(`Packed ${fileName}`)
	}
}

// Emoji packs are prebuilt ZIPs and previews, downloaded only when selected.
if (existsSync(ThemePacksDir)) {
	cpSync(ThemePacksDir, PacksDir, { recursive: true })
	console.log(`Copied packs from ${ThemePacksDir}`)
}

console.log(`Packed ${count} plugin(s) into ${PagesDir}`)
