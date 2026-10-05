# Talyxel Park v0.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Talyxel Park into a working social site for Planet Zoo / Planet Coaster builders: Instagram-style posts (updates and questions) with likes and comments in a followers feed, profiles with a top-down parks section, new map tools (utilities, walk routes, areas of interest, habitats), a manual park-statistics form, a tutorial for new users, design tokens that sync with Figma, and the next items from `DEVELOPMENT_PLAN.md`.

**Architecture:** Express 5 + `node:sqlite` API (schema changes are new entries in `MIGRATIONS`), React 19 + TanStack Query client, shared types/constants in `shared/`. The `events` table stays the single backbone of the feed: a user post is an event of type `post_created` pointing at a `posts` row, so every feed card (post or automatic activity) has one id that likes, comments and notifications hang off. Walk routes are the first *line* shapes (open polylines) next to the existing polygon shapes.

**Tech Stack:** TypeScript 7, Express 5, node:sqlite, zod 4, React 19, react-router 8, TanStack Query 5, lucide-react, Vitest + Supertest, Playwright (system Chrome locally, bundled Chromium in CI).

**Spec:** the user's request of 2026-10-05 (quoted in the session) plus `DEVELOPMENT_PLAN.md`.

## Global Constraints

- Node `>=22.22.0`; no native modules (keep `node:sqlite`).
- Never edit an old migration; add new entries to `MIGRATIONS` in `server/db.ts`.
- Every state-changing API call keeps requiring the `x-talyxel: 1` header.
- Uploads: PNG/JPEG/WebP/GIF, ≤ 8 MB each, magic-byte checked (reuse `server/uploads.ts`).
- Drafts stay private: nothing about a draft park may leak through feed, posts, profile, notifications or stats.
- Definition of done per task: `npm run typecheck`, `npm test`, `npm run build` and `npm run e2e` pass; UI checked at desktop (1280×800) and phone (390×844) widths via Playwright screenshots.
- Copy style: short, friendly, British-ish spelling already used in the app ("colour", "favourite").
- Work on branch `feature/v0.2-social-and-planner`, one commit per task; fast-forward `main` and push only when everything is finished.

## Review Focus

1. A post linked to a park that is later unpublished must not reveal the draft park to other users (feed card shows the post without the park). → test in Task 4.
2. Merging photo uploads into one feed entry (`recordPhotosAdded`) must not wipe likes/comments on that entry. → test in Task 4.
3. A walk route (line) switched to a polygon kind with only 2 corners must be rejected, and polygon kinds with < 3 corners too. → test in Task 2.
4. Stats input with junk (negative guests, text in number fields, too many custom rows) must 400 with a readable message, and drafts' stats must 404 for strangers. → test in Task 3.
5. Notifications must not be created for acting on your own content and must disappear on unlike/unfollow. → test in Task 6.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `shared/constants.ts` | + kinds `utility`, `route`, `interest`; `LINE_KINDS`; per-kind subject lists; post/stat limits |
| `shared/geometry.ts` | + `polylineLength`, `walkMinutes` |
| `shared/stats.ts` (new) | per-park-type stat field definitions + value helpers |
| `shared/types.ts` | + `Post`, `Comment`, `ParkStats`, `NotificationItem`, `Onboarding`; `FeedItem` gains post/likes/comments, `zoo` nullable |
| `server/db.ts` | migration v3: rebuild `events` (nullable `zoo_id`, `post_id`), `posts`, `post_photos`, `likes`, `comments`, `zoo_stats`, `notifications`, `users.onboarding_dismissed` |
| `server/schemas.ts` | kind-aware point validation, post/comment/stats inputs |
| `server/feed-items.ts` (new) | load `FeedItem`s for a list of event rows (shared by feed, profile posts, detail) |
| `server/notify.ts` (new) | create/remove notifications |
| `server/routes/posts.ts` (new) | create post, item detail, likes, comments, delete |
| `server/routes/notifications.ts` (new) | list + mark read |
| `server/routes/onboarding.ts` (new) | tutorial checklist progress + dismiss |
| `server/routes/zoos.ts` | + `PUT /:id/stats` |
| `src/components/feed/PostCard.tsx` (new) | Instagram-style card (header, media carousel, actions, caption, comments) |
| `src/components/feed/MediaCarousel.tsx` (new) | swipeable photo/map carousel with double-tap like |
| `src/components/feed/Composer.tsx` (new) | create update/question posts |
| `src/components/feed/Comments.tsx` (new) | comment list + input |
| `src/components/ParkMapCard.tsx` (new) | profile parks section card with a big top-down map |
| `src/components/StatsForm.tsx`, `src/components/StatsView.tsx` (new) | manual park statistics |
| `src/components/NotificationBell.tsx` (new) | nav bell + panel |
| `src/components/tutorial/*` (new) | welcome dialog, planner tour, getting-started checklist |
| `src/pages/GuidePage.tsx`, `src/pages/PostPage.tsx` (new) | written tutorial; single post page |
| `src/pages/planner/ShapePalette.tsx`, `LayersMenu.tsx`, `ShortcutsOverlay.tsx` (new) | add-shape palette, layer toggles, `?` overlay |
| `design/tokens.json`, `scripts/tokens.ts`, `src/styles/tokens.css` | Figma-syncable design tokens → CSS variables (light + dark) |
| `e2e/*.spec.ts`, `playwright.config.ts` | browser tests |
| `.github/workflows/ci.yml` | typecheck, test, build, e2e |

---

### Task 1: Browser test harness + CI

**Files:** Create `playwright.config.ts`, `e2e/helpers.ts`, `e2e/smoke.spec.ts`, `.github/workflows/ci.yml`; Modify `package.json` (scripts `e2e`, devDependency `@playwright/test`), `.gitignore` (`.e2e-data/`, `test-results/`, `playwright-report/`), `vite.config.ts` (exclude `e2e/` from vitest).

**Interfaces — Produces:** `e2e/helpers.ts`: `register(page, username)`, `apiAs(request, username)` returning a logged-in API context, `createPark(api, body)`.

- [ ] Add `@playwright/test`; config uses `channel: 'chrome'` unless `CI`, projects `desktop` (1280×800) and `phone` (390×844, touch), `webServer` = `npm run build && tsx server/index.ts` with `PORT=4317 DATA_DIR=.e2e-data` (fresh dir per run).
- [ ] Smoke spec: landing renders the brand, register a user, feed greets them, create a zoo plan, planner opens.
- [ ] Run `npm run e2e` → PASS on both projects.
- [ ] CI workflow: Node 22, `npm ci`, typecheck, test, build, `npx playwright install --with-deps chromium`, e2e.
- [ ] Commit `test: add Playwright e2e harness and CI`.

### Task 2: New map shapes — utilities, walk routes, areas of interest (+ palette and layers)

**Files:** Modify `shared/constants.ts`, `shared/parks.ts`, `shared/geometry.ts`, `server/schemas.ts`, `server/routes/zoos.ts`, `server/routes/habitats.ts`, `src/components/map/MapCanvas.tsx`, `src/components/map/HoverCard.tsx`, `src/components/ZooThumbnail.tsx`, `src/components/KindIcon.tsx`, `src/lib/shapes.ts`, `src/pages/planner/PlannerPage.tsx`, `src/pages/planner/HabitatPanel.tsx`, `src/pages/planner/ZooPanel.tsx`, `src/pages/ZooPage.tsx`, `src/pages/FeedPage.tsx`, `src/styles/map.css`, `src/styles/planner.css`; Create `src/pages/planner/ShapePalette.tsx`, `src/pages/planner/LayersMenu.tsx`; Tests `tests/geometry.test.ts`, `tests/api.test.ts`, `e2e/planner.spec.ts`.

**Interfaces — Produces:**
- `HABITAT_KINDS` += `'utility' | 'route' | 'interest'`; `LINE_KINDS: readonly HabitatKind[] = ['route']`; `isLineKind(kind): boolean`; `minPoints(kind): 2 | 3`.
- `KIND_META[kind].subjects?: readonly string[]`, `.subjectLabel?: string`.
- `polylineLength(points): number` (metres), `walkMinutes(metres): number` (4 km/h).
- `ZooThumbnail` prop `highlight?: { points: Point[]; kind: HabitatKind }`.
- `MapCanvas` `Tool` += `'line'`; prop `hiddenKinds?: ReadonlySet<HabitatKind>`.

- [ ] Write failing tests: `polylineLength([[0,0],[3,4],[3,10]]) === 11`; API: route with 2 points → 201; polygon kind with 2 points → 400; PATCH route → `kind: 'habitat'` while it has 2 points → 400; utility/interest allowed in both park types; theme park can't switch type check still works.
- [ ] Implement shared + server changes; `npm test` → PASS.
- [ ] Map: render routes as dashed polylines with direction arrows and a wide invisible hit stroke; line drawing tool (click to add, double-click/Enter to finish, ≥ 2 points); vertex/mid handles without the closing segment; utilities hatched, interest areas dashed with a pin icon; hover card + panels show length and walking time for routes.
- [ ] Shape palette above the map ("Add: Habitat · Utility · Walk route · Area of interest · …") picks the kind and the right tool; Layers menu hides/shows kinds in planner and on the public park page legend.
- [ ] e2e: draw a utility (rect), a walk route (line) and an area of interest (polygon) through the palette; see them in the hover card / panel; hide routes via Layers.
- [ ] Screenshots desktop + phone; typecheck, test, build, e2e → PASS. Commit `feat(planner): utilities, walk routes, areas of interest, palette and layers`.

### Task 3: Manual park statistics

**Files:** Create `shared/stats.ts`, `src/components/StatsForm.tsx`, `src/components/StatsView.tsx`; Modify `server/db.ts` (migration v3 part: `zoo_stats`), `server/schemas.ts`, `server/queries.ts`, `server/routes/zoos.ts`, `shared/types.ts`, `src/api/client.ts`, planner (`ZooPanel` "Park statistics" section + dialog), `src/pages/ZooPage.tsx`, `src/components/ZooCard.tsx` (guests chip); Tests `tests/api.test.ts`, `e2e/stats.spec.ts`.

**Interfaces — Produces:**
- `STAT_FIELDS: Record<ParkType, StatField[]>`, `StatField = { key; label; type: 'int'|'decimal'|'percent'|'money'|'rating'; hint?; min?; max? }`.
- `ParkStats = { values: Record<string, number>; custom: { label: string; value: string }[]; gameDate: string; updatedAt: string; previous: Record<string, number> | null }`.
- `ZooDetail.stats: ParkStats | null`; `ZooSummary.guests: number | null`.
- `PUT /api/zoos/:id/stats` body `{ values, custom, gameDate }` → `ParkStats`. Same UTC day updates the latest snapshot, otherwise inserts a new one (so `previous` shows change).

- [ ] Failing API tests: save stats → returned in detail; unknown key / negative guests / percent > 100 → 400; > 12 custom rows → 400; second save next day keeps `previous`; stranger gets 404 for a draft; non-owner PUT → 403.
- [ ] Implement; tests PASS.
- [ ] UI: form grouped by section with units (€/$-agnostic "money" shown as plain number with thousands separators), validation messages, custom rows add/remove; park page "Park statistics" tiles with ▲/▼ change and "from the map" computed stats (area, walk-route length, shapes).
- [ ] e2e: fill and save stats in planner, view on public page with change after a second save. Screenshots. All checks PASS. Commit `feat: manual park statistics`.

### Task 4: Posts, likes, comments and the Instagram-style feed

**Files:** Modify `server/db.ts` (migration v3: rebuild `events`, add `posts`, `post_photos`, `likes`, `comments`), `server/events.ts` (merge keeps likes/comments), `server/routes/feed.ts` (use `server/feed-items.ts`), `server/app.ts`, `server/schemas.ts`, `shared/types.ts`, `src/api/client.ts`, `src/pages/FeedPage.tsx`, `src/App.tsx`; Create `server/feed-items.ts`, `server/routes/posts.ts`, `src/components/feed/{PostCard,MediaCarousel,Composer,Comments}.tsx`, `src/pages/PostPage.tsx`, `src/styles/feed.css`; Tests `tests/social.test.ts`, `e2e/feed.spec.ts`.

**Interfaces — Produces:**
- `FeedItem` = `{ id; type: FeedEventType | 'post_created'; createdAt; actor; zoo: ZooSummary | null; habitat; photos; survey; post: { kind: 'update'|'question'; body: string } | null; likes: number; liked: boolean; commentCount: number; comments: Comment[] }` (`comments` = latest 2 in lists, all on detail).
- `Comment = { id; body; createdAt; author: UserSummary; canDelete: boolean }`.
- Routes: `POST /api/posts` (multipart `photos[]` ≤ 10, `body`, `kind`, `zooId?`) → `FeedItem`; `GET /api/activity/:id` → `FeedItem`; `DELETE /api/activity/:id` (own posts only); `PUT|DELETE /api/activity/:id/like` → `{ likes, liked }`; `GET|POST /api/activity/:id/comments`; `DELETE /api/comments/:id` (author or item owner); `GET /api/users/:username/posts` → `FeedItem[]`.

- [ ] Failing tests: create update with photos + question without photos; post shows in followers' feed with `post` data; like/unlike idempotent with counts; comment add/list/delete permissions; question needs ≥ 3 chars and update needs text or photo; linking a draft park → 400; post linked to a park that gets unpublished shows `zoo: null` to others; likes on an activity event for an unpublished park → 404; photo-merge keeps likes and comments; deleting a post removes files.
- [ ] Implement migration + routes; tests PASS (existing 21 still PASS).
- [ ] UI (frontend-design pass): Instagram-like cards for every feed item — header with avatar ring, name, park "location", menu; 4:5 media (photo carousel with dots/arrows/swipe, top-down map for park/shape events, gradient text card for text-only questions); action bar (heart with pop animation + double-tap, comment, share-link); likes line; caption; "View all N comments"; inline comment box ("Answer…" for questions). Composer at top of feed (Update / Question, photos with previews, link a published park). `/p/:id` page shows one card with all comments.
- [ ] e2e: post an update with a photo and a question, follower sees both, likes (double-click) and answers; counts update; delete own post. Screenshots desktop + phone. All checks PASS. Commit `feat: Instagram-style posts, likes and comments in the feed`.

### Task 5: Profile with parks section (top-down) and posts grid

**Files:** Modify `server/routes/users.ts` (+ counts `posts`), `shared/types.ts` (`Profile.postCount`), `src/pages/ProfilePage.tsx`, `src/styles/pages.css`; Create `src/components/ParkMapCard.tsx`; Test `tests/social.test.ts`, `e2e/profile.spec.ts`.

- [ ] Failing test: profile returns `postCount`; `/users/:u/posts` lists only that user's posts newest first.
- [ ] UI: Instagram-style header (avatar, name, counts: posts · parks · followers · following, bio, follow / edit); **Parks section** with large top-down maps (legend dots by kind, stats line, Draft badge for own drafts); tabs Posts (3-column square grid → `/p/:id`), Followers, Following.
- [ ] e2e + screenshots; all checks PASS. Commit `feat(profile): parks section with top-down maps and posts grid`.

### Task 6: Notifications

**Files:** Create `server/notify.ts`, `server/routes/notifications.ts`, `src/components/NotificationBell.tsx`; Modify `server/db.ts` (notifications table in v3), `server/routes/users.ts` (follow), `server/routes/posts.ts` (like, comment), `server/routes/surveys.ts` (suggestion), `server/app.ts`, `src/components/Layout.tsx`, `shared/types.ts`; Tests `tests/social.test.ts`, `e2e/feed.spec.ts`.

- [ ] Failing tests: follow/like/comment/suggestion notify the owner; self-actions don't; unlike/unfollow remove the notification; `POST /notifications/read` zeroes `unread`; drafts never notify.
- [ ] Implement + bell with unread badge (polls every 60 s), panel linking to the item/profile.
- [ ] e2e: second user likes → first user sees badge. All checks PASS. Commit `feat: in-app notifications`.

### Task 7: Planner productivity (from DEVELOPMENT_PLAN phase 2)

**Files:** Modify `src/pages/planner/PlannerPage.tsx`, `useZooEditor.ts`, `ZooPanel.tsx`; Create `src/pages/planner/ShortcutsOverlay.tsx`; Test `e2e/planner.spec.ts`.

- [ ] Duplicate (Ctrl+D / button), copy & paste (Ctrl+C / Ctrl+V, offset by one grid step, clamped), redo (Ctrl+Shift+Z / Ctrl+Y) for geometry, `?` keyboard shortcut overlay.
- [ ] e2e: duplicate a shape → two shapes; undo/redo moves it back and forth. All checks PASS. Commit `feat(planner): duplicate, copy/paste, redo and shortcut overlay`.

### Task 8: Tutorial for new users

**Files:** Create `server/routes/onboarding.ts`, `src/components/tutorial/{WelcomeDialog,GettingStarted,PlannerTour}.tsx`, `src/pages/GuidePage.tsx`, `src/styles/tutorial.css`; Modify `server/db.ts` (users column), `server/app.ts`, `src/App.tsx`, `src/pages/AuthPage.tsx`, `src/pages/FeedPage.tsx`, `src/pages/planner/PlannerPage.tsx`, `src/components/Layout.tsx`; Tests `tests/social.test.ts`, `e2e/tutorial.spec.ts`.

- [ ] Failing test: `GET /api/onboarding` progress flips as the user creates a park, draws a shape, adds a route, saves stats, publishes, follows, posts; `POST /api/onboarding/dismiss` hides it.
- [ ] Welcome dialog after sign-up (4 slides), getting-started checklist card on the feed, interactive planner tour with coach marks (palette → tools → map → panel → stats → publish), "?" help button reopens it, `/guide` page with the full written tutorial.
- [ ] e2e: new user sees welcome, finishes tour, checklist ticks after creating a park. Screenshots. All checks PASS. Commit `feat: tutorial for new users`.

### Task 9: Design tokens synced with Figma (+ dark mode)

**Files:** Create `design/tokens.json` (W3C design-token format, Tokens Studio compatible), `scripts/tokens.ts`, `src/styles/tokens.css` (generated), `design/README.md`; Modify `src/styles/base.css` (vars move to tokens), CSS literals → variables, `src/components/Layout.tsx` (theme toggle), `package.json` (`tokens` script, run before `dev`/`build`); Test `tests/tokens.test.ts`.

- [ ] Failing test: generating CSS from `design/tokens.json` equals the committed `src/styles/tokens.css`; every `var(--x)` used in `src/styles/*.css` is defined.
- [ ] Implement generator, light + dark themes, theme toggle (system default, remembered per browser).
- [ ] If the Figma MCP connection is authorised: publish the tokens as Figma variables and the key screens to a Figma file; otherwise document the Tokens Studio sync in `design/README.md`.
- [ ] Screenshots in both themes. All checks PASS. Commit `feat(design): Figma-syncable design tokens and dark mode`.

### Task 10: Seed, docs, final verification, ship

- [ ] Seed: routes, utilities, interest areas, stats, posts (updates + questions with photos), likes, comments, notifications.
- [ ] README + DEVELOPMENT_PLAN (v0.2 section, ticked items), this plan's checkboxes.
- [ ] Full run: `npm run typecheck && npm test && npm run build && npm run e2e`; manual screenshot review of every page at both widths with seeded data.
- [ ] Fast-forward `main`, push to `origin main`.
