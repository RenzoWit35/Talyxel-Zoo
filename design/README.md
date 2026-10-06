# Design tokens and Figma

The colours, shadows, corner radii and fonts of Talyxel Park live in `design/tokens/` as [W3C design tokens](https://www.designtokens.org/) (DTCG JSON). They are the single source of truth: `npm run tokens` turns them into `src/styles/tokens.css`, and `npm run dev` and `npm run build` do that automatically.

| File | What's in it |
| --- | --- |
| `tokens/base.json` | Radii, font families and the navigation height — the same in both themes |
| `tokens/theme.light.json` | Colours and shadows for the light theme (the default) |
| `tokens/theme.dark.json` | The same tokens for the dark theme |

The values come from the *Parkmakers* Figma file (Home dashboard, Social, Zoo and Coaster Park Builder, public park page): Inter for interface text and Manrope for headings, `bg` #f3f1eb, `brand` #3c674f, `coaster` #ff4d8d and `navy` #1d1f4a for theme parks, and a tight corner scale: 3 px (keys), 5 px (inputs, tiles), 6 px (`radius-control`: buttons, chips, tabs), 8 px (images, inner panels) and 12 px (cards, dialogs). Use the radius that fits the element's role rather than one radius everywhere. Pages line up with the top bar using `--gutter` (40 px, 16 px on phones) instead of sitting in a narrow centred column.

The public landing page has its own palette: `lp-navy` #0A2239 (hero background), `lp-lime` #DCEAB2 (primary buttons, with navy text), `lp-sage` #A8CCC9 (tags, poll bars, highlights), `lp-olive` #60712F (category pills, leaves) and `lp-taupe` #716A5C (borders on the navy, secondary text on light sections). They are the same in both themes; the logged-out header's "Start your park" uses the lime too.

The whole app uses the same idea: primary buttons are navy with lime text on light surfaces in light mode and lime with navy text on navy (bands, the planner bar, dark mode), `brand` is olive (links, progress), text is navy with taupe for secondary text, and the first header on every tab is a full-width navy band with an olive pill, a heavy white title and leaves in the corners (`src/styles/bands.css`). Every page ends with the ride skyline footer (`SiteFooter` in `src/components/decor.tsx`). The planner bar is navy too: lime for zoos, purple-navy and pink for theme parks.

The park maps have their own tokens: `ground`, `ground-tuft` (grass speckles), `ground-glow` and `ground-shade` (soft patches) and `hedge` (the park edge). The decorations on shapes — trees, ripples, paving, roofs, coaster tracks — live in `src/components/map/terrain.tsx` and are shared by the planner, the park page and every thumbnail.

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

The site follows the system setting. The light/dark switch in the account menu (or the moon button in the logged-out header) picks a theme and remembers it in the browser; `public/theme.js` applies that choice before the page draws so there's no flash. In CSS, use the tokens (`var(--surface)`, `var(--ink)`, …) for anything that should change with the theme. White text and dark overlays on photos stay the same in both themes; mark such lines with `/* same in both themes */`.

## Adding a token

Add it to **both** theme files (or to `base.json`), run `npm run tokens` and use it as `var(--name)`. The CSS variable name is the token's name inside its group: `color.bg-deep` → `--bg-deep`, `shadow.shadow-lg` → `--shadow-lg`.
