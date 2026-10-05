# Design tokens and Figma

The colours, shadows, corner radii and fonts of Talyxel Park live in `design/tokens/` as [W3C design tokens](https://www.designtokens.org/) (DTCG JSON). They are the single source of truth: `npm run tokens` turns them into `src/styles/tokens.css`, and `npm run dev` and `npm run build` do that automatically.

| File | What's in it |
| --- | --- |
| `tokens/base.json` | Radii, font families and the navigation height — the same in both themes |
| `tokens/theme.light.json` | Colours and shadows for the light theme (the default) |
| `tokens/theme.dark.json` | The same tokens for the dark theme |

Both theme files must define the same token names in the same order; the generator refuses otherwise. A test (`tests/tokens.test.ts`) checks that `tokens.css` is up to date, that every CSS variable the app uses is defined, and that stylesheets don't hard-code theme colours.

## Changing the design in Figma

Use either route; both read and write these JSON files.

**Figma variables (built in)**

1. In Figma, open the Variables panel and import `theme.light.json` and `theme.dark.json` as the **Light** and **Dark** modes of one collection, and `base.json` as a second collection.
2. Change colours in Figma and design screens with those variables.
3. Export the collection back to JSON (one file per mode), replace the files in `design/tokens/`, run `npm run tokens`, check the app and commit.

**Tokens Studio plugin (syncs with GitHub)**

1. Install the Tokens Studio plugin and add a GitHub sync to this repository with the path `design/tokens` (multiple files, W3C DTCG format).
2. Pull, edit tokens in the plugin and push. The plugin opens a commit or pull request that changes the JSON.
3. Run `npm run tokens` (or let `npm run build` / CI do it) and the site picks up the change.

## Dark mode

The site follows the system setting. The sun/moon button in the header picks a theme and remembers it in the browser; `public/theme.js` applies that choice before the page draws so there's no flash. In CSS, use the tokens (`var(--surface)`, `var(--ink)`, …) for anything that should change with the theme. White text and dark overlays on photos stay the same in both themes; mark such lines with `/* same in both themes */`.

## Adding a token

Add it to **both** theme files (or to `base.json`), run `npm run tokens` and use it as `var(--name)`. The CSS variable name is the token's name inside its group: `color.bg-deep` → `--bg-deep`, `shadow.shadow-lg` → `--shadow-lg`.
