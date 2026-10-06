# Talyxel Park

A planning board and social feed for **Planet Zoo** zoos and **Planet Coaster** theme parks. Draw your park from above, fill every habitat or ride with screenshots and notes, keep your in-game stats, and share updates and questions with the builders you follow.

## Features

- **Zoos and theme parks.** When you start a plan you pick its type, and the planner adapts to it:

  | | Zoo (Planet Zoo) | Theme park (Planet Coaster) |
  | --- | --- | --- |
  | Shape types | Habitat, exhibit, utility, walk route, area of interest, facility, water, path, scenery | Roller coaster, flat ride, water ride, shop/food, themed area, utility, walk route, area of interest, facility, water, path, scenery |
  | Details | Species (Planet Zoo autocomplete), biome | Ride type (coaster/ride autocomplete), theme (Pirate, Western, Spooky, …) |
  | Statistics | Guests, happiness, zoo rating, animals, species, welfare, conservation credits, money, staff, education | Guests, happiness, park rating, rides, coasters, excitement, scenery, money, staff |

  You can switch a plan's type later from the planner's side panel, as long as it only contains shape types both share.
- **Top-down planner.** An **Add** bar above the map picks what to draw: habitats or rides, **utilities** (power, water, staff rooms, workshops…), **walk routes** (open lines with direction arrows, length and walking time) and **areas of interest** (viewpoints, keeper talks, photo spots — shown with a pin). Draw with the freeform, rectangle or line tool, or trace over a screenshot of your park. Shapes snap to the grid and to each other's corners; drag, reshape, nudge, duplicate (Ctrl+D), copy and paste, undo and redo. A **Layers** menu hides shape types; `?` shows every shortcut. Everything autosaves.
- **Hover cards and details.** Hover any shape to see its photos and facts; click it to open its photos, description and **why it's built this way** — a note per shape about the thinking behind it. Each park can also state its **design principle** in one sentence.
- **Planning board.** A kanban view (Idea → Planned → Building → Done) with drag & drop and quick ideas.
- **Park statistics.** Type in your in-game numbers (plus any extra stats and the in-game date). Saving on a later day keeps the earlier snapshot, so the park page shows what went up or down.
- **Publish with a survey.** Publishing makes the plan public and announces it to your followers, optionally with a survey ("What should I add next?") that visitors vote on or add suggestions to.
- **Home and Social.** Signed-in builders land on a **Home** dashboard: recent projects with how much is built, recent activity and the next getting-started step. **Social** (`/social`) is the feed, filtered by For you, Friends, Following or Questions.
- **Posts, likes and comments.** Share an **update** (up to 10 screenshots, optionally linked to a published park) or ask a **question**. A post leads with its title and text, then one photo, a photo grid or the park map with a location pill and how much is built. Double-click a picture to like it; comments show as bubbles (answers on questions); park surveys can be voted on right in the post; every post has its own page at `/p/:id`.
- **Profiles.** Counts for posts, parks, followers and following; a **Parks** section with each park's whole top-down plan; a square grid of posts.
- **Notifications.** A bell for new followers, likes, comments and survey suggestions.
- **Tutorial for new users.** A welcome after signing up, a "next step" card on Home that ticks itself off, a coach-mark tour the first time you open the planner, and a written guide at `/guide`.
- **Design.** The look follows the *Parkmakers* Figma design: Inter and Manrope, a warm off-white background, deep park green, and navy with coaster pink for theme parks.
- **Light and dark mode**, following the system or the switch in the account menu. Colours come from [design tokens](design/README.md) that sync with Figma.

See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for the roadmap: what's done, the next phases, and how we work.

## Getting started

You need Node.js 22.22 or newer. SQLite is built into Node, so there are no native modules to compile.

```bash
npm install
npm run seed   # optional: demo builders, parks, posts, likes and photos
npm run dev    # API on :3001, web app on http://localhost:5173
```

The demo accounts are `talyxel`, `rosa`, `kai`, `milan` and `lotte` (who has a Planet Coaster park). They all use the password `zoo-demo-123`.

### Production

```bash
npm run build  # builds the web app into dist/
npm start      # serves the API and dist/ on PORT (default 3001)
```

| Variable          | Default    | Purpose                                                                     |
| ----------------- | ---------- | --------------------------------------------------------------------------- |
| `PORT`            | `3001`     | HTTP port                                                                   |
| `DATA_DIR`        | `./data`   | SQLite database (`talyxel.db`) and uploaded images (`uploads/`)             |
| `TRUST_PROXY`     | `loopback` | Express `trust proxy` setting; set it when you run behind a reverse proxy (`true`, a hop count, or addresses) |
| `AUTH_RATE_LIMIT` | `30`       | Log-in and sign-up attempts allowed per IP per 10 minutes                   |

Back up `DATA_DIR` to keep your users, plans and photos. Database changes are applied automatically on start.

## Scripts

| Script              | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `npm run dev`       | API (auto-reload) and Vite dev server                               |
| `npm run build`     | Production build of the web app                                    |
| `npm start`         | Run the server (serves `dist/` when present)                        |
| `npm run seed`      | Fill an empty database with demo content                            |
| `npm test`          | API, geometry and design-token tests (Vitest + Supertest)           |
| `npm run e2e`       | Browser tests on desktop and phone sizes (Playwright)               |
| `npm run typecheck` | TypeScript check for client, server, tests and scripts              |
| `npm run tokens`    | Regenerate `src/styles/tokens.css` from `design/tokens/*.json`       |

The browser tests use the Chrome installed on your machine; CI installs Playwright's Chromium (`E2E_CHANNEL` picks another browser channel). CI runs typecheck, unit tests, build and browser tests on every push and pull request.

## Project layout

```
server/            Express API
  app.ts           app factory (routes, uploads, SPA fallback, security headers)
  db.ts            node:sqlite connection + migrations
  auth.ts          scrypt passwords, cookie sessions, CSRF guard, rate limit
  routes/          auth, users (follows, posts), zoos (+ stats), habitats + photos,
                   surveys, feed, posts (likes, comments), notifications, onboarding
  feed-items.ts    turns feed events into post cards (with whole surveys to vote on)
  events.ts        feed events (only for published parks)
  notify.ts        notifications
  seed.ts          demo data (photos are generated, not downloaded)
shared/            types, constants, park types (parks.ts), stats fields, geometry
src/               React app
  components/map/  MapCanvas (SVG planner/viewer), hover card, layer toggles
  components/feed/ post card, photo grid / park map, in-post poll, composer
  components/tutorial/  welcome dialog, getting-started steps, coach-mark tour
  pages/planner/   planner page, palette, panels, board, tour, shortcuts
  pages/           home, social feed, activity, post, explore, people, profile, park page, guide, auth
design/            design tokens (synced with Figma) — see design/README.md
scripts/tokens.ts  design tokens → CSS variables
tests/             API, geometry and token tests
e2e/               Playwright browser tests
```

## Security notes

- Passwords are hashed with scrypt. Sessions use random tokens stored hashed in the database, sent as an `httpOnly`, `SameSite=Lax` cookie.
- Every state-changing API call needs an `x-talyxel: 1` header, which blocks cross-site form posts (CSRF).
- Uploads (shape photos and post photos) must be PNG, JPEG, WebP or GIF, at most 8 MB each. The server checks each file's magic bytes, stores it under a random name and serves it with `nosniff` and a sandboxing CSP. Linked images must use `https://`.
- Drafts stay private everywhere: feed, posts, profiles, stats and notifications only show published parks.
- Login and registration are rate-limited per IP.
