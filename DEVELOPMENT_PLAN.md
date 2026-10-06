# Talyxel Park — development plan

This plan covers what's built, what comes next, and how we work. Each phase can ship on its own. Sizes are rough: **S** is about a day, **M** a few days, **L** a week or more. Tick items off as they land on `main`.

## Where we are (v0.3)

### New in v0.3 — the Parkmakers look
- [x] Restyled after the *Parkmakers* Figma design: new tokens (Inter + Manrope, park green, coaster pink, navy), a top bar with a centred Home / Social / Parks / Explore switcher, search and an account menu
- [x] Home dashboard: recent projects with build progress, quick links, recent activity, and the getting-started checklist as a "next step" card
- [x] Social at `/social` with filters (For you, Friends, Following, Questions — `/api/feed?filter=`), a profile card, open questions and builders to follow
- [x] Posts lead with a title and text; one photo, a photo grid or the park map with a location pill and "% built"; park surveys are votable inside the post
- [x] Planner: new project bar, the selected-shape panel from the design, navy and pink chrome for theme parks
- [x] "Why it's built this way" per shape (`reason`, migration v7) and a design principle per park (`principle`, migration v8), shown on the public park page
- [x] Public park page: big header with "Designed by", the map as a stage with a floating detail card, "in numbers", the design principle and the in-game rating
- [x] Tighter corners (3–12 px, buttons and chips 6 px), full-width pages aligned with the top bar, People as a card grid, a split log-in screen
- [x] Livelier maps: grass, soft patches, a hedge and a compass; trees, rocks, ripples, paving, roofs with shadows, coaster tracks and ride footprints on shapes — in the planner, on park pages and in thumbnails
- [x] The landing look on every tab: navy header bands with olive pills and leaves, lime primary buttons, olive links, taupe secondary text, a navy planner bar and the ride skyline footer; dark mode in navy
- [x] 53 API/unit tests and 29 browser tests (desktop and phone); typecheck and build are clean

### New in v0.2

- [x] Posts: updates (up to 10 screenshots, optionally linked to a published park) and questions
- [x] Instagram-style feed cards for posts and park activity: square swipeable carousel (photos, top-down map, text card), double-tap likes, comments/answers, share link, a page per post (`/p/:id`)
- [x] Profiles: counts (posts, parks, followers, following), a Parks section with each park's top-down plan, a posts grid
- [x] New map shapes in both park types: utilities, walk routes (the first line shape — length and walking time) and areas of interest; an "Add" palette above the map and a Layers menu
- [x] Manual park statistics per park type, with daily snapshots so the park page shows what changed
- [x] In-app notifications: followers, likes, comments, survey suggestions
- [x] Tutorial for new users: welcome dialog, self-ticking getting-started checklist, first-visit planner tour, written guide (`/guide`)
- [x] Planner: duplicate, copy and paste, redo for moves and reshapes, `?` shortcut overlay
- [x] Design tokens in `design/tokens` (W3C format, syncs with Figma variables or Tokens Studio) and a dark theme
- [x] Playwright browser tests (desktop and phone) and GitHub Actions CI
- [x] Fixes: navigation blanked the app in current Chrome (`scrollTo` returns a Promise); phones had no link to your own profile
- [x] 50 API/unit tests and 26 browser tests; typecheck and build are clean

### From v0.1

- [x] Accounts: register, log in and out, edit your profile (display name, bio, avatar colour)
- [x] Park types: Zoo (Planet Zoo) and Theme park (Planet Coaster), each with its own shape types, species or ride types, and biomes or themes
- [x] Top-down planner: freeform and rectangle drawing, grid and corner snapping, move/reshape/nudge, undo, background screenshot tracing, autosave
- [x] Hover cards with each shape's photo collection and facts, plus a full gallery and lightbox on click
- [x] Planning board (Idea → Planned → Building → Done) with drag & drop and quick ideas
- [x] Photo uploads (PNG, JPEG, WebP, GIF up to 8 MB, checked by content) and https image links
- [x] Publishing with surveys: vote, suggest options, results hidden until you vote, close or reopen, several surveys per park
- [x] Social: follow (mutual follows are friends), activity feed, people search, profiles
- [x] Explore with search and a park-type filter
- [x] Demo seed with five builders and generated photos

## Phase 1 — Go live

Goal: a hosted site friends can sign up to, which doesn't lose data.

| Item | Size | Notes |
| --- | --- | --- |
| ~~CI on GitHub Actions: typecheck, test, build on every PR~~ | S | ✅ v0.2 — also runs the browser tests. Turn on branch protection for `main` |
| Hosting: one Node process with a persistent volume for `DATA_DIR` | M | Fly.io, Railway or a small VPS. Set `TRUST_PROXY`, serve over HTTPS |
| Nightly backups of the SQLite file and uploads | S | `sqlite3 .backup` to object storage; test a restore once |
| Image thumbnails (resize on upload) | M | Feed cards, hover cards and the posts grid still load full-size images |
| Error logging and a health check monitor | S | `/api/health` already exists |
| Account deletion and data export | S | Delete cascades already exist in the schema |
| Password reset by email | M | Needs an email provider. Until then, the admin resets passwords by hand |
| Report a park, post, comment or photo, plus a basic admin page to hide content | M | Needed before opening sign-ups to strangers — posts and comments make this more urgent |

## Phase 2 — A better planner

Goal: planning a big park feels quick and safe.

| Item | Size | Notes |
| --- | --- | --- |
| Undo and redo for every edit (fields, deletes, board moves), not just geometry | M | v0.2 added redo for moves and reshapes. Keep deleted shapes and photos restorable for a short window |
| ~~Duplicate, copy and paste shapes~~ | S | ✅ v0.2 (photos aren't copied) |
| Multi-select (shift-click or box select): move and delete together | M | |
| Rotate shapes | S | |
| Line tool for paths and queues: a polyline with a width | M | v0.2 made walk routes lines; give paths and queue lines a width next |
| Measure tool and a scale calibration for background screenshots (click two points, enter the distance) | M | Makes areas accurate for traced screenshots |
| Layers: show or hide by shape type, and lock the background | S | ✅ show/hide in v0.2; locking the background is still to do |
| Version history: named snapshots of a plan you can restore or compare | L | |
| Export the map as PNG or PDF, and as a share image | M | |
| ~~Keyboard shortcut overlay (`?`) and a first-run tutorial~~ | S | ✅ v0.2 |

## Phase 3 — Community

Goal: give people reasons to come back and react to each other's builds.

| Item | Size | Notes |
| --- | --- | --- |
| ~~Notifications: new follower, votes and suggestions on your survey, comments~~ | M | ✅ in-app in v0.2 (follows, likes, comments, suggestions). Next: an email digest, and live updates instead of polling every minute |
| Comments on individual shapes | M | v0.2 has comments on posts and park activity; needs the moderation tools from phase 1 |
| A "popular" sort on Explore | S | Likes exist since v0.2 — count likes on a park's activity |
| Visibility per park: private, friends only, or public | M | The feed and Explore already filter on publish state; extend that |
| Share links with preview images (Open Graph) | S | `/p/:id` pages exist; uses the map export from phase 2 |
| Co-owners: invite a friend to edit a plan together | L | Needs conflict handling; start with "last save wins" per field |
| Survey extras: multiple choice, end date, "build it" button that turns the winning option into an idea card | M | |
| Mentions (`@rosa`) and hashtags in posts and comments | M | Notify the mentioned builder |

## Phase 4 — Deeper game support

Goal: the planner knows the games.

| Item | Size | Notes |
| --- | --- | --- |
| Planet Zoo species data: minimum land and water area, biome and continent | L | Warn when a habitat is too small or has the wrong biome for its species |
| Planet Coaster ride stats: excitement, intensity, nausea, capacity | M | Show on hover cards and as park totals; the manual park stats from v0.2 already hold park-wide numbers |
| Steam Workshop links per shape or park (blueprints) | S | |
| Planet Coaster 2 water parks as a third park type: pools, flumes, lazy rivers | M | `shared/parks.ts` and `shared/stats.ts` make adding a type mostly configuration |
| Planet Zoo 2 (or other games) when they arrive | M | Same mechanism |
| Stats history chart on the park page | S | Snapshots are already stored per day |

## Phase 5 — Polish and reach

| Item | Size | Notes |
| --- | --- | --- |
| Dutch translation (and i18n setup for more languages) | M | All UI text is in components today |
| ~~Dark mode~~ | S | ✅ v0.2, from the design tokens |
| Accessibility pass: keyboard drawing, screen-reader labels for shapes, contrast | M | |
| Mobile planner polish: larger handles, a two-finger rotate gesture | M | Viewing and basic editing work on phones; the bottom sheet hides the map while editing details |
| PWA install and offline viewing of your own plans | M | |
| Push the key screens to Figma | S | v0.3 follows the Parkmakers Figma file; push the built screens back so design and code stay side by side. Tokens already sync (see `design/README.md`) |
| Saved posts (the bookmark in the Figma post design) | S | Not built yet — the post footer shows "Open park" in that spot |
| Builder ratings for parks (the "4.9 / 5 from 218 builders" card in the design) | M | The park page shows the in-game rating from the builder's own stats for now |

## Technical debt and known limits

- **Internal names are still zoo-centric.** The `zoos` and `habitats` tables, `/api/zoos`, and the `species` and `biome` fields now cover theme parks, utilities and walk routes too. Rename them (`parks`, `shapes`, `subject`, `setting`) in one migration once the API has outside users or it starts to confuse contributors.
- **`node:sqlite` is still marked experimental in Node.** It works well and keeps installs native-free. Pin the Node version in hosting and re-check on each Node major. SQLite is fine for one server; move to Postgres only if we ever run several app servers. On Windows, Vitest's forked workers sometimes crashed on exit with it loaded, so the unit tests run in worker threads.
- **Uploads live on the local disk** under `DATA_DIR/uploads`. Move them to object storage (S3 or R2) when hosting needs more than one machine or easier backups.
- **The rate limiter is in-memory**, so it resets on restart and isn't shared between servers. That's fine for one instance. Posting and commenting aren't rate-limited yet.
- **Notifications are polled** every minute and on focus. Server-sent events would make them live.
- **The feed is built on the `events` table**: a post is an event of type `post_created`, so likes, comments and notifications hang off one id for every card. Migration v4 rebuilt `events` to make `zoo_id` optional.
- **Hover cards don't exist on touch devices** by design: tapping opens the details panel instead.

## How we work

- **Branches and PRs:** every change goes through a pull request into `main`. Keep PRs focused, one feature or fix each.
- **Definition of done:**
  - `npm run typecheck`, `npm test`, `npm run build` and `npm run e2e` pass.
  - New API behaviour has a test in `tests/`; new UI flows have a browser test in `e2e/` (desktop and phone).
  - UI changes are checked at desktop and phone widths, in light and dark mode.
  - User-facing docs (README, the guide at `/guide`, this plan) are updated.
- **Schema changes** are new entries in the `MIGRATIONS` list in `server/db.ts`. Never edit an old migration.
- **Park types and stats:** to add or change one, start in `shared/parks.ts`, `shared/constants.ts` and `shared/stats.ts`. The server validates against the same lists.
- **Design:** colours and shadows come from `design/tokens`; run `npm run tokens` after changing them. Don't hard-code theme colours in CSS (a test checks).
- **Demo data:** keep `npm run seed` working; it doubles as a smoke test for the API.
