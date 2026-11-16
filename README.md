# Valenced Plugins

Plugins I use and maintain for [Valenced](https://github.com/Valenced/valenced).

## Install

Add this URL as a plugin repository in Valenced:

```
https://hakuxyz.github.io/valenced-plugins/index.json
```

Open the Valenced settings, go to Plugins, add the repository and install whatever you need.

## Plugins

| Plugin | Description | Credit |
| --- | --- | --- |
| [Fake Profile Themes](plugins/fake-profile-themes) | Show profile colors hidden in bios with invisible 3y3 encoding. | ryan, Alyxia Sother, Remty |

More plugins are coming soon.

## Colors in your bio

Fake Profile Themes uses the same legacy 3y3 format as Vencord, Vendetta and Revenge, so bios written with any of those plugins keep working.

Open the plugin settings, tap **Primary color** or **Accent color** to open Discord's color picker, or type a hex value directly. Then press **Copy 3y3** and paste the invisible text anywhere into your bio. When you change your colors later, remove the old 3y3 text and paste the new one. If a bio contains several codes, the newest one wins.

## Credits

The plugins are ports of existing community work. Every plugin directory has its own LICENSE and NOTICE file with the original source and license.

The build setup is based on the [Valenced community plugins](https://github.com/Valenced/valenced-community-plugins) repository.

## License

The repository scaffolding is MIT licensed. Each plugin keeps the license of its original project.
