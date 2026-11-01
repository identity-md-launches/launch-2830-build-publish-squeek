# Squeek & Glide

A Vietnamese, side-view endless flight game for Squeekchain Genesis Code Lane. You fly a handmade cardboard box; a real hamster's wheel supplies the wind. The complete static website is in **`dist/`**. Editable React, TypeScript and original Canvas/SVG artwork are included.

**Playing requires a fresh, valid hardware reading from Squeekchain.** There is no practice mode, simulated fallback, speed slider, wallet, backend or private configuration. During a service outage the website loads normally and explains why play is waiting.

## Install, preview and rebuild

Use Node 22.12+ or Node 24 (validated with Node 24.21.0), and npm.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run preview -- --port 4173
```

Open the preview URL printed by Vite. `npm run dev` runs the source development server. `npm run build` replaces `dist/`; keep the entire output together, including fonts, favicon and share image. `vite.config.ts` sets `base: './'`, and the finished export uses relative asset URLs. Serve over HTTP(S), including under a gateway subpath; do not open the HTML through `file://`.

The publisher serves the supplied export; it does not rebuild it. No publishing command, remote hosting configuration or live domain is required here. The provided `dist/` is the publication handoff.

For a continuation assignment that prohibits creating `node_modules/` in the checkout, use an external build copy:

```sh
SQUEEK_BUILD_DIR=$(mktemp -d /tmp/squeek-glide.XXXXXX)
node scripts/sync-check.mjs "$SQUEEK_BUILD_DIR"
npm --prefix "$SQUEEK_BUILD_DIR" ci
npm --prefix "$SQUEEK_BUILD_DIR" run typecheck
npm --prefix "$SQUEEK_BUILD_DIR" test
npm --prefix "$SQUEEK_BUILD_DIR" run build
```

Then replace the checkout's `dist/` with that copy's `dist/`. Do not append to an older export: remove obsolete hashed assets. Keep dependency folders, caches and browser downloads outside the submission at every nesting level. No ignore file was added or changed for this assignment; dependencies were installed only outside the repository. An ignore-file change in a future task needs its own explicit path budget.

## Controls and round lifecycle

- Select **Bắt đầu bay** when the hardware connection is valid. A three-second countdown precedes flight.
- Tap/click the game canvas, or focus the game and press **Space**, to flap. Gravity and flap impulse never change. Keyboard repeat, secondary touch pointers and compatibility click events do not produce extra flaps.
- Each passed wall pair gives one point. Each collected sunflower seed gives one extra point. Scoring has no effect on wind or gap progression.
- Touching cardboard or the ceiling/floor ends the round immediately. A striped candy-wrapper parachute unfolds for 1.8 seconds, followed by the final score, local best and **Bay lần nữa**. The parachute is cosmetic. With reduced motion the end sequence lasts 0.45 seconds.
- **Escape**, the pause button, or **Cách chơi** can pause a run. Manual pauses require **Tiếp tục bay**. Closing help preserves an earlier manual pause.
- Lost or unusable data freezes the world, scores, flaps and gameplay animation. Fresh data starts a new uninterrupted three-second countdown; any further signal loss cancels it.
- Hidden tabs stop polling and invalidate the pending response. Returning requests fresh data before the countdown. Orientation changes also request fresh data and ask you to continue. Ordinary resizing changes presentation only.

The personal best uses `squeek-glide.best.v1` in localStorage. Corrupt values become zero. If storage access or saving is denied, the current session remains playable and a new best stays in memory; the result explains that limitation. There is no shared leaderboard.

## Hardware contract

Reference: [Squeekchain API documentation](https://docs.squeekchain.com/developers/api/). Only `GET https://api.squeekchain.com/v1/status` is read, without query parameters, credentials or a relay. The implementation validates the fields it consumes and ignores unrelated additional fields.

A usable reading requires:

- numeric `schemaVersion === 1` and a non-null object `measurement`;
- `freshness === 'online'`, `provenance === 'hardware'`;
- `coreStatus` exactly `ACTIVE` or `IDLE` (never `COUNTER_FAULT`);
- a finite, safe, nonnegative integer `rpmMilli`, as specified by the API schema;
- a valid RFC3339-style `receivedAt`, a finite positive `staleAfterSeconds`, and a measurement that has not expired. At most five seconds of future clock skew is tolerated; impossible calendar dates are rejected.

Polling starts immediately and normally repeats on a five-second start-to-start cadence. The timeout is four seconds, with at most one request outstanding. Fetch/JSON/HTTP failures back off through 5, 10, 20, 40 and 60 seconds. HTTP 429/503 also honor the longer `Retry-After` delay, including HTTP-date form. A successful but unusable response keeps play paused and is polled again after five seconds. `cache: 'no-store'` avoids reusing a browser cache; `receivedAt + staleAfterSeconds` is still checked every 200 ms, every animation frame and at flap/start input. Expiration between polls cannot keep a round alive.

`RPM = rpmMilli / 1000`. `src/game/config.ts` contains the owner-editable mapping: 0–120 RPM maps to 1.0–2.2×, clamped. Fresh `IDLE` forces 1.0× and displays **Hamster đang nghỉ**, while the numeric RPM and wheel still represent the measurement. A zero-RPM wheel is stationary; the aircraft still travels at minimum speed. Valid wind changes use an exponential time constant of 0.67 seconds, reaching about 95% of the change after two seconds. No RPM-dependent vertical physics or obstacle dimensions exist.

## World and fairness

All screens show the same **480 × 640** game world, fitted with a fixed 3:4 aspect ratio. Desktop side scenery reveals no extra approaching obstacles. The player remains at x=130; the world scrolls left at 120–264 units/second. The forgiving collision rectangle is 36 × 44 units and excludes decorative wings and ear tips.

Physics runs at 120 fixed substeps/second. A rendered frame can consume at most 250 ms of simulation; extra elapsed time is discarded instead of tunneling through a wall. Pause/resume discards the remainder and the first frame's elapsed time. Countdown time does not turn into physics catch-up.

Gates are 64 units wide, spaced every 330 world units, with the first at x=640. Gap heights are immutable: gates 1–10 are 250 units high; gates 11–30 shrink linearly to 184; later gates stay at 184. Gap centers stay in [220, 420], moving at most 52 units between pairs, never during flight. Seeds are offset at most 38 units and have at least 35 units of edge clearance after accounting for the player hitbox. Decorative gnaw lines are inset into solid walls and do not imply safe collision openings.

At maximum wind the clear horizontal interval between two wall encounters is `(330 - 64 - 36) / 264 = 0.871` seconds. Even the narrowest neighboring safe-center bands overlap by 88 vertical units (64 with an additional 12-unit margin on both sides). The deterministic pilot tests cover 4,500 gates, including maximum and alternating center shifts. If changing maximum wind, hitbox, gravity, flap impulse, gap bounds or spacing, rerun and extend the reachability tests together.

## Source map and continuation

| File | Responsibility |
| --- | --- |
| `src/live/signal.ts` | Input validation, freshness, one-request poller, timeout/backoff, visibility epochs |
| `src/game/config.ts` | Fixed world/physics parameters, owner-editable RPM mapping and gap progression |
| `src/game/engine.ts` | Pure flight simulation, scoring, pause/countdown/end state, local best helpers |
| `src/game/art.ts` | Original editable drawing paths: hamster, cardboard craft, seed-shell wings, candy wrapper, scenery, gates and seeds |
| `src/App.tsx` | Browser integration, controls, screens, focus, hardware/wheel display and reduced-motion preference |
| `src/Icons.tsx`, `src/style.css` | SVG UI elements and documented design tokens/components |
| `tests/` | Deterministic simulation, parser, timeout and polling tests; no test data enters the production import graph |
| `scripts/validate-browser.mjs` | Production export interaction checks with test-only response interception plus a separate real API observation |
| `scripts/capture-share.mjs` | Recreates `public/share.png` from the game's own Canvas art; run after a build, then rebuild to copy the image into `dist/` |
| `DESIGN.md`, `artifacts/validation.md` | Final implemented design and check evidence, fixes and limitations |

For a change: run the relevant tests, typecheck, rebuild, inspect the production export on mobile, and replace `dist/` after the final source edit. Preserve the strict hardware gate. Do not introduce test fixtures, a localhost endpoint, query-switchable mock mode or synthetic readings into runtime code. `test/scratch/` is temporary and may be deleted at any time; the build has no dependency on it or on the pinned assignment inputs.

## Browser checks and recorded results

```sh
npx playwright install --with-deps chromium webkit
npm run test:browser
# Optional: run one named group
npm run test:browser -- 'cached data'
# Compact landscape, scrolled start/retry, and 200% text regression checks
npm run test:browser -- 'compact HUD'
```

The browser script starts and closes its own local server at `/preview/`, tests the built output, and writes temporary evidence under `test/scratch/browser/`. Most edge cases use clearly isolated, deterministic network fixtures. The last check contacts the real API and records only the public measurement fields used by the game. These tests add no practice mode to the site.

Revision validation on 2026-11-01: production build and TypeScript check succeeded; **19/19 unit tests**, **19/19 Chromium/WebKit browser groups**, and **16/16 pinned design-probe checks** passed. Both reported viewport bugs were first reproduced with the real status API. The revised HUD and result panels use the stage space around the unchanged 3:4 canvas; enlarged result text scrolls, and start/retry bring the whole game into view before countdown rendering. The real API returned fresh hardware IDLE data; the production preview had no JavaScript or missing local-resource errors. Results, measurements, review coverage and limitations are recorded in [artifacts/validation.md](artifacts/validation.md), with a response to each finding in `.imd-responses.json`. These are worker observations, not independent certification. Native iPhone hardware, a screen-reader session and browser-native zoom were not tested; viewport resizing and 200% text enlargement were tested separately.

See [NOTICE.md](NOTICE.md) for font and design-reference attribution. The art, fonts and share card are local assets; only the public hardware status API is needed while playing.
