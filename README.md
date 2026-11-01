# Squeek & Glide

A handmade 2D flying game powered by real Squeekchain hamster activity. Tap to fly, dodge cardboard obstacles, and collect Golden Seeds for double points.

You pilot. A real hamster powers the wind.

This release continues the same [repository](https://github.com/identity-md-launches/launch-2830-build-publish-squeek) and [game URL](https://squeek-glide-ban-lai-hamster-tao.imd.site/). The editable React/TypeScript source and the complete IPFS-compatible static export in `dist/` are included. Public play requires fresh, valid hardware data. There is no practice mode, account, wallet, backend, or online leaderboard.

## Install, preview and rebuild

Use Node 22.12+ or Node 24 and npm. The existing package manifest and lockfile are unchanged.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run preview -- --port 4173
```

`npm run dev` previews the source. `npm run build` replaces `dist/`; retain the whole export, including its local fonts, favicon, share image, and hashed assets. The existing Vite configuration uses `base: './'`. Serve the export over HTTP(S), including at a gateway subpath; opening `index.html` with `file://` is unsupported.

If a continuation assignment prohibits `node_modules/` in the repository, build outside it:

```sh
SQUEEK_BUILD_DIR=$(mktemp -d /tmp/squeek-glide.XXXXXX)
node scripts/sync-check.mjs "$SQUEEK_BUILD_DIR"
npm --prefix "$SQUEEK_BUILD_DIR" ci
npm --prefix "$SQUEEK_BUILD_DIR" run typecheck
npm --prefix "$SQUEEK_BUILD_DIR" test
npm --prefix "$SQUEEK_BUILD_DIR" run build
```

Replace the checkout's entire `dist/` with that build's `dist/`, removing obsolete hashed files. Keep all dependency folders, caches, browser downloads, and package archives outside the submission. The narrow `.gitignore` allowlist retains only the release evidence named in `artifacts/path-budget.json` (1 MiB aggregate artifact cap; 2 KiB ignore-file cap). Dependency/cache folders remain ignored at every depth.

To regenerate the English share illustration from the same Canvas artwork, run `node scripts/capture-share.mjs` after building, then build again to copy `public/share.png` into `dist/`.

## Features and controls

- Select **Start flying** when a hardware reading is available. A three-second countdown precedes play.
- **Tap/click the flight area or press Space to flap.** Each input gives one flap; release to fall. Holding, key repeat, secondary touch contacts, and compatibility click events do not add flaps.
- Pass an obstacle pair for **+1** and collect an ordinary sunflower seed for **+1**. One prominent total appears during flight and on the result screen; the smaller best score is saved on this device.
- A glowing **Golden Seed marked x2** gives no immediate points. It doubles new pair and ordinary-seed points for **8 seconds of active flight**. Another Golden Seed refreshes the duration to eight seconds. It never stacks or changes previously earned points.
- Golden Seeds first appear in a randomly selected pair **11–18**, then every **6–8 pairs**. Each interval is selected once. The seed sits 24 world units above or below gap center and replaces that pair's ordinary seed.
- The gold badge shows remaining time and a shrinking ring; a light gold trail marks the aircraft. Manual pause, help, signal loss, hidden tabs, orientation pauses, and all countdowns freeze the timer. Expiration, collision, and retry remove the effect.
- **Pause** or **Escape** freezes a flight. **Resume** begins another three-second countdown. **How to play** opens a keyboard-accessible modal; closing it preserves an existing manual pause.
- Cardboard, ceiling, or floor contact ends the round before any scoring in that physics step. A candy-wrapper parachute unfolds cosmetically, then **Fly again** starts a new flight. Reduced motion shortens the end sequence.
- Lost or unusable data pauses automatically. A new valid hardware response starts a fresh three-second countdown. Hidden tabs invalidate pending readings and stop polling; returning fetches again. Rotation requests fresh data and asks you to resume. Ordinary resizing only changes presentation.

## Live hamster and wind

Only `GET https://api.squeekchain.com/v1/status` is read, without credentials or query parameters. See the [Squeekchain API documentation](https://docs.squeekchain.com/developers/api/).

A usable measurement has numeric `schemaVersion === 1`, `freshness === 'online'`, `provenance === 'hardware'`, `coreStatus === 'ACTIVE'` or `'IDLE'`, and a finite, safe, nonnegative integer `rpmMilli`. Its RFC3339 measurement time and positive expiry must be valid and fresh; impossible dates and more than five seconds of future skew are rejected. Missing data, non-hardware provenance, unknown schemas/statuses, counter faults, stale data, HTTP errors, and malformed responses never become sleeping/IDLE readings.

- **ACTIVE:** the hamster runs inside a wheel. Continuous rotation uses measured RPM, including a complete stop at zero RPM. Numeric RPM and wind remain visible.
- **IDLE:** the hamster curls up asleep with gentle breathing and the wheel stands still, even if the measurement retains a nonzero RPM. **Resting / Hamster resting** identifies this valid state. Flight targets its existing 1.0× minimum speed.
- **Connecting or unusable data:** a disconnected signal symbol replaces the hamster, unavailable numbers show a dash, and an English message explains the state. There is no fabricated data fallback.

`RPM = rpmMilli / 1000`. The unchanged `src/game/config.ts` maps 0–120 RPM to 1.0–2.2× wind, clamped. Flight wind uses the existing 0.67-second exponential smoothing; vertical gravity and flap impulse stay constant. Reduced motion stops the wheel, running paws, and breathing while preserving status text and essential gameplay.

Polling normally starts every five seconds, with a four-second timeout and at most one request outstanding. Failures back off through 5/10/20/40/60 seconds; 429/503 honor a longer `Retry-After`. Successful unusable responses are retried every five seconds. Freshness is checked between requests, on animation frames, and at start/flap input. There is no server-side component in this repository.

## Physics, fairness, and saved records

The existing world remains 480 × 640 at a fixed 3:4 ratio. Player x=130, gravity=720, flap impulse=−250, scrolling=120–264 units/second, and the forgiving 36 × 44 collision rectangle are unchanged. The cardboard box, wooden braces, watermelon-seed-shell wings, and striped candy-wrapper parachute remain the original editable artwork.

Obstacle pairs remain 64 units wide and 330 units apart, starting at x=640. The first ten gaps stay 250 units tall; gaps 11–30 narrow to 184, then stay fixed. Centers remain within 220–420 and shift by at most 52 units per pair. Spawning follows distance, never a wall-clock interval. Golden Seed placement leaves at least 46 units of edge clearance after accounting for the player hitbox in the narrowest gap.

Physics uses 120 fixed steps per second and discards excessive frame elapsed time. The power-up uses 960 integer simulation ticks, avoiding floating-point timer drift. All collisions are checked first, all Golden Seed pickups second, then eligible points. The timer advances only with those active physics steps. Pause/resume discards accumulated remainder and the first resumed frame's elapsed time, preventing background time jumps.

Best scores retain the existing **`squeek-glide.best.v1`** localStorage key, so previous records survive this release. Invalid stored values are ignored. If saving is denied, the new best remains in memory for the session and the result explains the limitation.

## Source map

| File                                   | Responsibility                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`                          | English interface, game screens, one score, x2 badge, controls/focus, visibility/orientation integration                     |
| `src/live/signal.ts`                   | Strict hardware validation, English signal states, freshness, polling/backoff/epochs                                         |
| `src/game/engine.ts`                   | Fixed-step simulation, scheduled Golden Seeds, collision/scoring order, active-time power-up, sessions and best storage      |
| `src/game/config.ts`                   | Preserved world dimensions, physics, RPM mapping and gap progression                                                         |
| `src/game/art.ts`                      | Original Canvas craft/scenery, ordinary and Golden Seeds, gold trail and parachute                                           |
| `src/Icons.tsx`, `src/style.css`       | SVG hamster states, tokens, responsive layouts, reduced motion                                                               |
| `tests/`                               | Deterministic simulation, power-up, signal, polling and storage tests                                                        |
| `scripts/validate-browser.mjs`         | Production Chromium/WebKit interactions, signal fixtures, compact layouts, axe and separate real-API observation             |
| `scripts/validate-powerup.mjs`         | Production canvas autopilot, actual Golden Seed pickup, badge/trail, pause/recovery/expiration, retry and persistence checks |
| `DESIGN.md`, `artifacts/validation.md` | Final design and actual validation coverage, findings, results and limitations                                               |

## Validate this release

```sh
npx playwright install --with-deps chromium webkit
npm run test:browser
node scripts/validate-powerup.mjs
# Optional focused groups
npm run test:browser -- 'compact HUD'
node scripts/validate-powerup.mjs chromium
```

Browser scripts serve the production export under `/preview/`, close their own server/browser, and write temporary evidence in `test/scratch/`. Their deterministic network responses and Canvas observation are development-only; no fixture, mock query parameter, practice switch, test hook, or fabricated reading is bundled into public play. The main browser script also separately observes the real API.

Production build and typecheck passed; **27/27 unit tests, 19/19 Chromium/WebKit browser groups, 2/2 production Golden Seed interaction checks, and 16/16 design-probe checks passed**. The requested compact sizes and 200% text were checked in both engines. A later review revision (landscape status-strip wrap at 200% text, visible session-only storage warning in landscape results) was rechecked with typecheck, build, 27/27 unit tests, 11/11 Chromium browser groups, the Chromium Golden Seed check and 16/16 design-probe checks; WebKit could not launch on that machine and was not rerun for it.

Validation for this release is recorded in [artifacts/validation.md](artifacts/validation.md), with retained machine-readable results and selected screenshots. These are worker observations, not independent certification. Physical iPhone/Android devices, a screen-reader session, browser-native 200% zoom, and exhaustive contrast over Canvas/transparent overlays are not verified. Viewport emulation and 200% text enlargement are separate checks.

## Repository About and publication handoff

The About description and website fields **were not changed**: this session has no authenticated GitHub metadata connector or GitHub CLI. The owner can apply these exact values, also supplied in [artifacts/github-about.json](artifacts/github-about.json):

**Description:** A handmade 2D flying game powered by real Squeekchain hamster activity. Tap to fly, dodge cardboard obstacles, and collect Golden Seeds for double points.

**Website:** https://squeek-glide-ban-lai-hamster-tao.imd.site/

This is an update to the existing project, not a replacement site. The publication target remains `squeek-glide-ban-lai-hamster-tao.identitymd.eth` and its existing game URL. The existing URL returned HTTP 200 during this task. The contributor publisher must pin the supplied `dist/` as the next version; no hosting or publishing command was run, and the new revision is not claimed live before that handoff.

Source base: [`387da98107bd6a00f45fa42b3dca55adda1701f0`](https://github.com/identity-md-launches/launch-2830-build-publish-squeek/commit/387da98107bd6a00f45fa42b3dca55adda1701f0). The assignment prohibits writes to `.git/`, so the updated commit is assigned by the submission pipeline rather than fabricated here. Existing repository ownership and history are preserved.

See [NOTICE.md](NOTICE.md) for font and design-guide attribution. All runtime art, fonts, favicon, and share assets are local; live gameplay needs only the public hardware status API.
