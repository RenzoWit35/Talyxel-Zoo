# Talyxel Park — development plan

This plan covers what's built, what comes next, and how we work. Each phase can ship on its own. Sizes are rough: **S** is about a day, **M** a few days, **L** a week or more. Tick items off as they land on `main`.

## Where we are (v0.1)

- [x] Accounts: register, log in and out, edit your profile (display name, bio, avatar colour)
- [x] Park types: Zoo (Planet Zoo) and Theme park (Planet Coaster), each with its own shape types, species or ride types, and biomes or themes
- [x] Top-down planner:
  - freeform and rectangle drawing, grid and corner snapping
  - move, reshape, add and remove corners, nudge, undo for shape edits
  - trace over a background screenshot
  - autosave
- [x] Hover cards with each shape's photo collection and facts, plus a full gallery and lightbox on click
- [x] Planning board (Idea → Planned → Building → Done) with drag & drop and quick ideas
- [x] Photo uploads (PNG, JPEG, WebP, GIF up to 8 MB, checked by content) and https image links
- [x] Publishing with surveys: vote, suggest options, results hidden until you vote, close or reopen, several surveys per park
- [x] Social: follow (mutual follows are friends), activity feed, people search, profiles
- [x] Explore with search and a park-type filter
- [x] Demo seed with five builders and generated photos
- [x] 21 API and geometry tests; typecheck and build are clean

## Phase 1 — Go live

Goal: a hosted site friends can sign up to, which doesn't lose data.

| Item | Size | Notes |
| --- | --- | --- |
| CI on GitHub Actions: typecheck, test, build on every PR | S | Branch protection on `main` once it's green |
| Hosting: one Node process with a persistent volume for `DATA_DIR` | M | Fly.io, Railway or a small VPS. Set `TRUST_PROXY`, serve over HTTPS |
| Nightly backups of the SQLite file and uploads | S | `sqlite3 .backup` to object storage; test a restore once |
| Image thumbnails (resize on upload) | M | Hover cards and feeds currently load full-size images |
| Error logging and a health check monitor | S | `/api/health` already exists |
| Account deletion and data export | S | Delete cascades already exist in the schema |
| Password reset by email | M | Needs an email provider. Until then, the admin resets passwords by hand |
| Report a park or photo, plus a basic admin page to hide content | M | Needed before opening sign-ups to strangers |

## Phase 2 — A better planner

Goal: planning a big park feels quick and safe.

| Item | Size | Notes |
| --- | --- | --- |
| Undo and redo for every edit (fields, deletes, board moves), not just geometry | M | Keep deleted shapes and photos restorable for a short window |
| Duplicate, copy and paste shapes | S | |
| Multi-select (shift-click or box select): move and delete together | M | |
| Rotate shapes | S | |
| Line tool for paths and queues: a polyline with a width, instead of a polygon | M | Fits paths, coaster tracks and rivers better |
| Measure tool and a scale calibration for background screenshots (click two points, enter the distance) | M | Makes areas accurate for traced screenshots |
| Layers: show or hide by shape type, and lock the background | S | |
| Version history: named snapshots of a plan you can restore or compare | L | |
| Export the map as PNG or PDF, and as a share image | M | |
| Keyboard shortcut overlay (`?`) and a first-run tutorial | S | |

## Phase 3 — Community

Goal: give people reasons to come back and react to each other's builds.

| Item | Size | Notes |
| --- | --- | --- |
| Notifications: new follower, votes and suggestions on your survey, comments | M | In-app first; email digest later |
| Comments on parks and on individual shapes | M | Needs the moderation tools from phase 1 |
| Likes or favourites, and a "popular" sort on Explore | S | |
| Visibility per park: private, friends only, or public | M | The feed and Explore already filter on publish state; extend that |
| Share links with preview images (Open Graph) | S | Uses the map export from phase 2 |
| Co-owners: invite a friend to edit a plan together | L | Needs conflict handling; start with "last save wins" per field |
| Survey extras: multiple choice, end date, "build it" button that turns the winning option into an idea card | M | |

## Phase 4 — Deeper game support

Goal: the planner knows the games.

| Item | Size | Notes |
| --- | --- | --- |
| Planet Zoo species data: minimum land and water area, biome and continent | L | Warn when a habitat is too small or has the wrong biome for its species |
| Planet Coaster ride stats: excitement, intensity, nausea, capacity | M | Show on hover cards and as park totals |
| Steam Workshop links per shape or park (blueprints) | S | |
| Planet Coaster 2 water parks as a third park type: pools, flumes, lazy rivers | M | `shared/parks.ts` makes adding a type mostly configuration |
| Planet Zoo 2 (or other games) when they arrive | M | Same mechanism |

## Phase 5 — Polish and reach

| Item | Size | Notes |
| --- | --- | --- |
| Dutch translation (and i18n setup for more languages) | M | All UI text is in components today |
| Dark mode | S | Colours already live in CSS variables |
| Accessibility pass: keyboard drawing, screen-reader labels for shapes, contrast | M | |
| Mobile planner polish: larger handles, a two-finger rotate gesture | M | Viewing and basic editing already work on phones |
| PWA install and offline viewing of your own plans | M | |

## Technical debt and known limits

- **Internal names are still zoo-centric.** The `zoos` and `habitats` tables, `/api/zoos`, and the `species` and `biome` fields now cover theme parks too. Rename them (`parks`, `shapes`, `subject`, `setting`) in one migration once the API has outside users or it starts to confuse contributors.
- **`node:sqlite` is still marked experimental in Node.** It works well and keeps installs native-free. Pin the Node version in hosting and re-check on each Node major. SQLite is fine for one server; move to Postgres only if we ever run several app servers.
- **Uploads live on the local disk** under `DATA_DIR/uploads`. Move them to object storage (S3 or R2) when hosting needs more than one machine or easier backups.
- **The rate limiter is in-memory**, so it resets on restart and isn't shared between servers. That's fine for one instance.
- **No e2e tests in the repo yet.** The browser checks were run by hand with Playwright. Add a small Playwright suite for drawing, publishing and voting to CI in phase 1.
- **Hover cards don't exist on touch devices** by design: tapping opens the details panel instead.

## How we work

- **Branches and PRs:** every change goes through a pull request into `main`. Keep PRs focused, one feature or fix each.
- **Definition of done:**
  - `npm run typecheck`, `npm test` and `npm run build` pass.
  - New API behaviour has a test in `tests/`.
  - UI changes are checked in a browser at desktop and phone widths.
  - User-facing docs (README, this plan) are updated.
- **Schema changes** are new entries in the `MIGRATIONS` list in `server/db.ts`. Never edit an old migration.
- **Park types:** to add or change one, start in `shared/parks.ts` and `shared/constants.ts`. The server validates against the same lists.
- **Demo data:** keep `npm run seed` working; it doubles as a smoke test for the API.
