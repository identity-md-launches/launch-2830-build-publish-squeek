# Squeek & Glide release validation

Date: 2026-11-01. This is a worker-authored implementation and validation record, not independent certification.

## Scope and result

The existing project was updated in place. React/TypeScript, the original storybook Canvas art, fixed physics/world, hardware-only input, local-best key, repository ownership, and publication identity remain. The production handoff is `dist/`, served and tested under `/preview/` with relative assets.

| Area                                                               | Result                                                                                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| English interface, hidden states, accessibility names and metadata | Implemented; source/copy audit and browser interactions checked                                                           |
| Running/resting/unknown hamster status                             | Implemented; ACTIVE/zero/IDLE/nonzero-IDLE, connection/error/fault/stale/missing/non-hardware states checked              |
| Golden Seeds and eight-second x2 scoring                           | Implemented; deterministic simulation and actual production Canvas pickup checked                                         |
| One total, smaller local best, simple controls                     | Implemented; duplicate HUD removed on results; persistence/retry checked                                                  |
| Compact screen/scroll fixes and text reflow                        | Preserved and checked in both browser engines                                                                             |
| Production build / typecheck                                       | Passed                                                                                                                    |
| Simulation and signal tests                                        | 27/27 passed                                                                                                              |
| Main Chromium/WebKit browser checks                                | 19/19 passed; raw results in `browser-results.json`                                                                       |
| Additional initial-connection fixtures                             | 2/2 passed, one group per engine; no unknown state shows a hamster                                                        |
| Production Golden Seed interaction checks                          | 2/2 passed, one per engine; raw results in `powerup-results.json`                                                         |
| Pinned taste@1 design probe                                        | 16/16 passed; raw report in `design-probe.json`                                                                           |
| GitHub About fields                                                | Not changed: no authenticated metadata tool/CLI; exact owner-applicable fields supplied in `github-about.json` and README |
| Existing URL and new publication                                   | Existing URL returned HTTP 200; updated export awaits the contributor publisher under the existing name                   |

## Commands and test environment

Dependencies were installed from the existing, unchanged lockfile in an external build copy. No repository `node_modules`, caches, dependency archives, or new build configuration were added. Existing Git exclusions hid the release records; a narrow `.gitignore` allowlist now includes the exact files budgeted in `path-budget.json`. Its cap is 2 KiB; all artifacts together are capped at 1 MiB. Dependency/cache directories stay ignored at every depth.

Executed install/build/check commands, from the external copy where applicable:

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm test
npm run build
node scripts/capture-share.mjs
npm run build
node scripts/validate-browser.mjs
node scripts/validate-browser.mjs malformed
node scripts/validate-browser.mjs 'denied storage'
node scripts/validate-browser.mjs 'compact HUD'
node scripts/validate-powerup.mjs
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

The pinned Playwright dependency is 1.56.1. Chromium 141 and WebKit 26 actually rendered the export. WebKit initially lacked host libraries/EGL; browser binaries and required shared libraries were installed outside the repository, and its final checks used software Mesa rendering and writable temporary caches. The runtime host-library validator was bypassed only after supplying the external library paths; both engines then launched and exercised the pages. These runtime adaptations changed no frontend dependency or production asset.

TypeScript passed after the last TypeScript source change. After the final storage-announcement and compact-HUD corrections, the production build and affected storage/compact/power-up browser checks were rerun. The full 19-group run and targeted rechecks are retained separately in `browser-results.json`. The final Vite production build transformed 34 modules and emitted `index.html`, one JS bundle, one CSS bundle, the local fonts/license, favicon, and the regenerated 1200×630 English share image. The static export's asset references resolve beneath `/preview/`; no failed local resources or page JavaScript errors were observed in the live-data browser check. Export hashes and sizes are in `export-manifest.json`.

## Interaction and simulation coverage

### Real status and development fixtures

The main browser script independently contacted `https://api.squeekchain.com/v1/status`: HTTP 200, schema 1, fresh hardware IDLE, 0 RPM, 120-second expiry. The public fields and observed timestamp are retained in `live-observation.json`. This is an observation at that timestamp, not a promise of service availability.

All ACTIVE/fault/stale/error scenarios use development-only intercepted API responses in the browser scripts. Public runtime imports neither those fixtures nor the Canvas recorder. There is no mock switch, query-selectable data, fixture endpoint, practice mode, account, wallet, or online score source.

Checked in Chromium and WebKit:

- Fresh ACTIVE shows the running hamster, rotating wheel, numeric RPM, and wind. ACTIVE at zero RPM stops the wheel and running paws without inventing IDLE.
- Fresh IDLE shows the curled sleeping hamster and stationary wheel, including a fixture with measured 60 RPM; numeric RPM remains 60 and wind is 1.0×.
- Initial pending connection, missing measurement, malformed JSON, unsupported schema, simulated provenance, expired data, and counter faults disable Start, show unknown signal art, and display unavailable telemetry. Unknown art contains no hamster.
- Cached data expires between requests. A dedicated regression expires the reading before the poller's next 200ms age check; both label and illustration immediately become stale/unknown.
- Network failure freezes the rendered world. Fresh hardware recovery requires a new three-second countdown. Hidden-tab return fetches again; orientation requests fresh data and pauses; ordinary resize leaves physics state unchanged.
- Reduced motion stops wheel rotation and sleeping breathing; CSS running-paw animation is motion-gated. Essential gameplay remains.

Pure signal tests also cover impossible calendar dates, unknown/null fields, invalid numeric inputs, exact expiry, clock skew, timeout abort, single outstanding request, stale-response visibility epochs, exponential backoff, and numeric/HTTP-date Retry-After handling.

### Golden Seed and scoring

The deterministic engine tests verify first scheduling within pairs 11–18, no golden pickup in the first ten, subsequent intervals of 6–8 pairs, interval selection only at scheduling, distance spacing, immutable placement, replacement of ordinary seeds, and gap-edge clearance. Routes at maximum wind pass 3,120 pairs with targets adjusted toward Golden Seeds. The retained original reachability test passes another 4,500 pairs, including extreme/alternating center shifts.

Tests verify no direct Golden Seed points; one-time consumption; activation before every eligible same-step pair/ordinary-seed point; preservation of previously earned points; +2 for each eligible point type; refresh to eight seconds without duration/×4 stacking; expiration restoring +1; and collision taking priority over every pickup/score. Powered/unpowered flights have identical y, velocity, wind, distance, and collision outcomes.

The exact-duration test checks 960 subsequent 1/120-second active steps: after 959 steps one step remains; step 960 expires the effect. Manual/help/orientation pauses, signal loss, hidden tabs, and countdowns freeze the timer. Death and retry clear it. Retry resets score, distance, velocity, wind, phase, and countdown.

The production browser autopilot observes the actual Canvas drawing commands, sends normal Space inputs, collects a reachable Golden Seed at maximum wind, and checks the visible x2 badge, ring, and four faint trail marks. Both engines reached score 22 at first pickup and score 34 at the checked result. It verifies timer freezes through manual pause, help, orientation, hidden-tab time, interrupted recovery, and resume countdowns; expiration removes badge/trail; game over clears the effect; retry starts at zero; a reload retains the saved best. This adds no hook to production game code.

### Controls, layout, and persistence

Both engines checked keyboard Start, Space flaps, Escape/Pause, Resume, help focus return, crash/parachute, final result, retry focus, and result scrolling. Pointer compatibility clicks, repeated Space keydown, and secondary touches leave the flight trajectory unchanged; a deliberate second flap changes it substantially. The comparison uses rendered craft position with at most one fixed step of timing tolerance, rather than comparing decorative pixels across browser contexts.

Both engines checked:

| Viewport           | States                                                                             |
| ------------------ | ---------------------------------------------------------------------------------- |
| 320×568            | Welcome/action visibility, reflow, assets                                          |
| 390×844            | Welcome, live states, play, help, pause, results, retry, x2                        |
| 768×1024           | Welcome and reflow                                                                 |
| 1440×1000          | Desktop welcome, assets and layout                                                 |
| 568×320            | Full world after scrolled Start/retry; visible score, x2, Pause, results and retry |
| 844×390            | Landscape play, x2, Pause, result/retry                                            |
| 390×844, 200% text | Reflow; scrolled Start/retry; score/Pause/x2; scrollable result                    |
| 568×320, 200% text | Scrolled Start/retry; visible HUD/x2; keyboard-scrolled result/retry               |

No horizontal overflow or clipped tested controls was found. Normal-size result actions fit; enlarged results remain reachable in their named scroll region via Home/End and Tab. The HUD keeps x2 clear of Pause. Measured world/score/Pause/result rectangles are retained in the viewport JSON files.

The local best uses the preserved `squeek-glide.best.v1` key. Engine tests cover corrupt/denied storage. Browser checks earn points, save a new record, show an English storage-denial message when applicable, retry successfully, and retain the best across reload.

## Better Interface: six-domain review

The pinned contents/workflow and each domain's core principles were read before implementation. The same guide's documentation workflow was used to update root `DESIGN.md`. MIT/Apache notices are preserved in `guide-licenses.txt` and `NOTICE.md`.

| Domain        | Coverage and evidence                                                                                                                                                                                                          | Limits                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Accessibility | Checked native buttons/dialog, English accessible names, keyboard flap/pause, focus return/retry, visible focus screenshot, 44px Pause/retry targets, polite status, reduced motion, axe scans on welcome/help in both engines | No screen-reader session, physical device, native zoom, or rendered forced-colors review                                       |
| Layout        | Checked first 390px screen, required portrait/landscape sizes, 320px reflow, enlarged text, full-world scrolled Start/retry, independent HUD/overlays, result keyboard scrolling                                               | Viewport emulation; not every possible browser chrome/safe-area combination                                                    |
| Writing       | Checked all start/help/play/pause/countdown/result/storage/signal/footer/tooltip/ARIA copy, `lang=en`, English numeric format, metadata, and regenerated share text                                                            | Human/source and tested-state review; no external translation review                                                           |
| Typography    | Checked preserved six-size scale, one local family, three weights, tabular changing numbers, wrapping, smaller best, no clipped tested labels                                                                                  | Font rendering differs by OS; no native zoom claim                                                                             |
| Colors        | Checked existing palette and gold roles; probe/axe plus computed badge colors and explicit sRGB measurements                                                                                                                   | Probe excludes 32 text boxes over Canvas/images/gradients; all translucent/Canvas pixel combinations not exhaustively measured |
| UI            | Checked button availability/hover/focus/press, running/resting/unknown art, x2 badge/ring/trail, countdowns, pause/retry, native modal, reduced motion and local share assets                                                  | No 10%-speed Animations-panel session; motion inspected normally and with preference emulation                                 |

Forms, transactions, wallet states, dark theme, and RTL localization are not applicable to this requested single-page English game; none was added to fill an audit checklist.

## Findings and corrections

| Finding                                                                                                                    | Source location and evidence                                                                                                             | Correction and recheck                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High: previous Vietnamese copy prevented the requested global-English release                                              | `src/App.tsx:10`, `src/live/signal.ts:25`, `index.html:2`, `scripts/capture-share.mjs:22`; original screens/messages/metadata/share text | Converted all visible/conditional/ARIA copy and English metadata; browser role lookups, source character audit, `lang=en`, and share inspection passed                                                                                                                                 |
| High: unknown data needed distinct art rather than resting implications                                                    | `src/Icons.tsx:95`, `src/App.tsx:569`; runtime signal scenarios                                                                          | Separate running/resting/unknown SVG branches; invalid/pending/stale/error fixtures contain no sleeping/running hamster; both engines passed                                                                                                                                           |
| Medium: a resting label could survive expiry until the next 200ms age tick                                                 | `src/App.tsx:66`, `src/App.tsx:593`; deliberately advanced Date.now before the age timer; reproduced in both engines                     | Visible message now uses the same render-time freshness gate as art/play; regression passes in both engines                                                                                                                                                                            |
| Medium: a storage-denied result announcement still claimed the new best was saved                                          | `src/App.tsx:55`, `src/App.tsx:659`; source audit of the translated result live region                                                   | Tooltip/accessible scope and result announcement now distinguish session-only best scores; storage-denial browser regression checks the announcement                                                                                                                                   |
| Medium: results duplicated the total HUD and gave equal emphasis to best/total on mobile                                   | `src/App.tsx:419`, `src/App.tsx:525`, `src/style.css:1235`; original result structure/type rules                                         | Result unmounts the play HUD, removes pair/seed breakdown, keeps best at 20px below main 28/48px; compact/result tests passed                                                                                                                                                          |
| Medium: compact landscape hid the requested Running/Resting label                                                          | `src/App.tsx:569`, `src/style.css:1270`; inspected 568×320 x2 screenshot showed only “Wheel connected”                                   | Valid compact readings now show the state title and hide only the secondary detail; unknown recovery messages remain. Both-engine status/power tests check visible state labels                                                                                                        |
| High: the centered compact HUD could cover the aircraft in the small landscape world                                       | `src/style.css:1280`; inspected 568×320 x2 screenshot showed the aircraft under the score surface                                        | Compact landscape HUD now places the score/x2 stack left of the world and Pause at the far right. Production tests assert its right edge stays left of the craft hitbox at normal and 200% text                                                                                        |
| Medium: x2 needed a visible, nonoverlapping active-time cue                                                                | `src/App.tsx:431`, `src/style.css:1195`, `src/game/art.ts:443`; production pickup screenshots                                            | Gold badge/ring beside one score, opaque readable backing, subtle trail; tested at requested sizes and 200% text in both engines                                                                                                                                                       |
| Medium: one initial WebKit axe scan flagged the primary label during availability changes                                  | `src/style.css:254`; initial `.primary > span` report; stable endpoint contrast measured 4.77:1 and independent rerun passed             | Removed background interpolation, keeping the existing colors and press transform; final axe scans pass in both engines. A transient transition cause was inferred, not proven                                                                                                         |
| High (review revision): at 568×320 with 200% text, the landscape status “Running” painted over “120 RPM”                   | `src/style.css:1059`–`1076`; reproduced in Chromium: `.source-title` x=94..206 vs first `.telemetry strong` x=177..249                   | Landscape strip now wraps; `.live-source` keeps a min-content width and `.telemetry` moves to its own right-aligned row when needed. Compact HUD test now uses ACTIVE 120 RPM and asserts no title/telemetry overlap, full RPM/wind labels, and full world on screen at all five sizes |
| Medium (review revision): short-landscape results hid the failed-save warning and still labelled the best “on this device” | `src/style.css:1094`, `src/App.tsx:534`–`555`; reproduced: `.local-note` `display:none`, 0×0 at 568×320 and 844×390                      | Warning carries `.is-warning` and is excluded from the landscape hide rule; all visible best-score scopes read “this session only” after a failed save. Denied-storage test asserts the label and a nonzero warning box at 568×320 and 844×390                                         |
| Low: the first English share card wrapped “wind” alone                                                                     | `scripts/capture-share.mjs:22`; inspected generated 1200×630 card                                                                        | Broke after “You pilot.” so the remaining sentence fits; regenerated and visually rechecked                                                                                                                                                                                            |

Two check-harness issues were also repaired: a 100ms fake-clock deadline could already be in the past on a loaded browser, and decorative pixel equality across independent contexts was overly strict. The fixed deadline now has ten seconds of virtual headroom; the input check compares actual rendered craft trajectories and verifies it detects a real extra flap. These changes do not weaken game scoring or collision assertions.

No unresolved repository implementation finding remains in the tested scope. The design idea remains one sentence: a handmade cardboard aircraft rides a mint paper sky whose wind comes from a real hamster wheel.

## Revision: reviewer findings (2026-11-01)

Two reopened findings were reproduced on the previous export before changing code, then fixed in CSS/markup only; no physics, scoring, signal or art code changed.

- `2fe8e980…` (high): reproduced exactly at 568×320/200% text with an ACTIVE 120 RPM fixture (29px horizontal overlap). No other tested combination (568×320, 844×390, 390×844, 1280×800 at 100%/200%, ACTIVE and IDLE) overlapped. After the fix the strip grows from 66px to 112px at 568×320/200% (bottom at 278px of 320) and the game world stays fully on screen after a scrolled start.
- `8d596990…` (medium): reproduced at 568×320 and 844×390 with denied storage (warning computed `display:none`). After the fix the warning is visible (320×36px) in both landscape sizes and the result label reads “this session only”; with working storage the landscape result still hides the routine note.

Commands run in an external copy (`/tmp`, `npm ci` from the unchanged lockfile): `npm run typecheck` (pass), `npm test` (27/27 pass), `npm run build` (pass; output copied to `dist/`, byte-identical to the build that was tested), `node scripts/validate-browser.mjs` (11/11 Chromium groups pass), `node scripts/validate-powerup.mjs` (Chromium pass), design probe `taste.mjs` (16/16 pass, `design-probe.json`). The two strengthened assertions were also run against the previous source and failed as expected (“568x320 at 200% text: status label overlaps telemetry”; “result best score must not claim device storage”). Results are under `revision2026_11_01` in `browser-results.json`; `export-manifest.json` was regenerated.

Limitation for this revision: WebKit could not launch on this machine (missing host GTK4/pango/cairo libraries), so the WebKit groups were not rerun; the WebKit results above are from the previous round and predate these two CSS/markup changes. Viewport emulation with 200% root font size, not native devices or browser zoom.

## Evidence and limitations

Selected retained screenshots are in `screenshots/`: 390px welcome, desktop welcome, keyboard focus, x2 play, compact landscape x2, 200% portrait x2, reconnecting, and enlarged landscape results. Additional temporary screenshots were generated under `test/scratch/` and are not part of the submission. The regenerated share asset is `public/share.png` and `dist/share.png`.

Browser-tool inspection separately walked the actual production export at 390×844: opened/closed How to play, restored focus, tabbed to Start, started through countdown, pressed Space, and paused. Its snapshot reported English language, score 0, no horizontal overflow, and zero console warnings/errors. This is not a screen-reader session.

The design probe reports 16/16 passed, no missing local assets, no horizontal overflow or text/control overlap at 320/390/1440, all tested solid text pairs above the required contrast, no card nesting, a complete share head, and no endless motion under reduced motion. The footer Data source link is below 44px high but passes the 24px/spaced-target check; primary game controls remain at least 44px.

Remaining limits: native iPhone/Android hardware, screen-reader output, browser-native zoom, rendered forced colors, and exhaustive Canvas/translucent-overlay contrast were not verified. Real service availability/hamster activity can change. Synthetic scenarios are isolated tests and are not claimed as live hardware observations.

## Identity, metadata, and completion

Existing repository: `https://github.com/identity-md-launches/launch-2830-build-publish-squeek`.

Existing URL: `https://squeek-glide-ban-lai-hamster-tao.imd.site/`. It returned HTTP 200 with the pre-update IPFS CID `bafybeiacacylby7my273bebf6cxnr6oaukhn35yuozznghhhwjkglbm5zi`. The next export is intended for the same publication name, `squeek-glide-ban-lai-hamster-tao.identitymd.eth`. No publishing command was run and this report does not claim the updated export is already pinned/live.

Source base commit: `387da98107bd6a00f45fa42b3dca55adda1701f0`. The task forbids `.git/` writes; the new source commit is assigned by the submission pipeline. No replacement repository, URL, token, owner, or history was created.

GitHub About metadata permissions were unavailable: no authenticated connector or CLI was exposed. The exact requested English description and existing website URL are in `github-about.json` for the owner to apply; README already uses that exact introduction.

**Complete for the repository implementation and local checks.** Publication, the new submission commit, and application of GitHub About fields remain the explicit external handoffs above. The raw addition-size budget, export manifest, and protected-path audit are retained with this report. No blocked-input file was needed.
