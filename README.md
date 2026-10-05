# Talyxel Zoo

A planning board for your **Planet Zoo** zoos and **Planet Coaster** theme parks. Draw your park from above, fill every habitat or ride with screenshots and notes, publish the plan with a survey about what to build next, and follow your friends to see their new additions in your feed.

## Features

- **Zoos and theme parks.** When you start a plan you pick its type, and the planner adapts to it:

  | | Zoo (Planet Zoo) | Theme park (Planet Coaster) |
  | --- | --- | --- |
  | Shape types | Habitat, exhibit, facility, water, path, scenery | Roller coaster, flat ride, water ride, shop/food, themed area, facility, water, path, scenery |
  | Details | Species (Planet Zoo autocomplete), biome | Ride type (coaster/ride autocomplete), theme (Pirate, Western, Spooky, …) |

  You can switch a plan's type later from the planner's side panel, as long as it only contains shape types both share (paths, water, scenery, facilities). Explore can filter by type.
- **Top-down planner.** Draw habitats, rides and themed areas on a metre grid with the freeform or rectangle tool, or trace over a screenshot of your park. Shapes snap to the grid and to each other's corners. You can drag shapes, reshape them by their corners, add or remove corners, nudge with the arrow keys and undo with Ctrl+Z. Everything autosaves.
- **Hover cards.** Hover any shape to see its photos, species or ride type, status, biome or theme, area and perimeter. Click it to open the full gallery and notes.
- **Planning board.** A kanban view (Idea → Planned → Building → Done). Drag cards to change their status, and jot down quick ideas that you place on the map later.
- **Publish with a survey.** Publishing makes the plan public and announces it to your followers. You can attach a survey ("What should I add next?"), and options are pre-filled from the shapes you marked as Idea. Visitors vote and can suggest their own options. Results stay hidden until you vote, and the owner can close the survey or start new ones.
- **Friends and feed.** Follow other builders; when you follow each other you're friends. Your feed shows the parks they publish, the habitats, rides and photos they add, and the surveys they start, but only for published parks. Drafts stay private.
- **Explore and people.** Browse published parks (filter by zoo or theme park, search by title, species, ride type or builder), find people, and view profiles.

## Getting started

You need Node.js 22.22 or newer. SQLite is built into Node, so there are no native modules to compile.

```bash
npm install
npm run seed   # optional: demo builders, zoos and photos
npm run dev    # API on :3001, web app on http://localhost:5173
```

The demo accounts are `talyxel`, `rosa`, `kai`, `milan` and `lotte` (who has a Planet Coaster park). They all use the password `zoo-demo-123`.

### Production

```bash
npm run build  # builds the web app into dist/
npm start      # serves the API and dist/ on PORT (default 3001)
```

| Variable      | Default    | Purpose                                                                     |
| ------------- | ---------- | --------------------------------------------------------------------------- |
| `PORT`        | `3001`     | HTTP port                                                                   |
| `DATA_DIR`    | `./data`   | SQLite database (`talyxel.db`) and uploaded images (`uploads/`)             |
| `TRUST_PROXY` | `loopback` | Express `trust proxy` setting; set it when you run behind a reverse proxy (`true`, a hop count, or addresses) |

Back up `DATA_DIR` to keep your users, plans and photos.

## Scripts

| Script              | What it does                                 |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | API (auto-reload) and Vite dev server        |
| `npm run build`     | Production build of the web app              |
| `npm start`         | Run the server (serves `dist/` when present) |
| `npm run seed`      | Fill an empty database with demo content     |
| `npm test`          | API and geometry tests (Vitest + Supertest)  |
| `npm run typecheck` | TypeScript check for client, server and tests |

## Project layout

```
server/            Express API
  app.ts           app factory (routes, uploads, SPA fallback, security headers)
  db.ts            node:sqlite connection + migrations
  auth.ts          scrypt passwords, cookie sessions, CSRF guard, rate limit
  routes/          auth, users (follows), zoos, habitats + photos, surveys, feed
  events.ts        feed events (only for published zoos)
  seed.ts          demo data (photos are generated, not downloaded)
shared/            types, constants, park types (parks.ts) and geometry used by both sides
src/               React app
  components/map/  MapCanvas (SVG planner/viewer) and the hover card
  pages/planner/   planner page, side panels, board view, publish dialog
  pages/           feed, explore, people, profile, public zoo page, auth
tests/             API and geometry tests
```

## Security notes

- Passwords are hashed with scrypt. Sessions use random tokens stored hashed in the database, sent as an `httpOnly`, `SameSite=Lax` cookie.
- Every state-changing API call needs an `x-talyxel: 1` header, which blocks cross-site form posts (CSRF).
- Uploads must be PNG, JPEG, WebP or GIF, at most 8 MB each. The server checks each file's magic bytes, stores it under a random name and serves it with `nosniff` and a sandboxing CSP. Linked images must use `https://`.
- Login and registration are rate-limited per IP.
