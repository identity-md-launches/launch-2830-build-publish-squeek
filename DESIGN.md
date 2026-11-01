# Squeek & Glide design

## Overview

Squeek & Glide is a small flying game for a global English-speaking audience. A cream hamster pilots a pale cardboard box through a mint paper landscape. Dark outlines, wooden braces, watermelon-seed-shell wings, orange cheeks, and a striped candy-wrapper parachute carry the handmade storybook style. This release preserves that artwork and the fixed 3:4 game world.

The first screen presents the product, the requested tagline, the craft, and **Start flying**. Live wheel status remains outside the world in every screen. The in-game HUD contains one prominent score, a smaller local best, and an optional gold x2 timer beside the score. The result replaces the HUD with one total and a smaller best; there are no point breakdowns or currencies.

The implementation is the source of truth: `src/style.css`, `src/App.tsx`, `src/Icons.tsx`, `src/game/art.ts`, and `src/game/engine.ts`. The design is one game interface, not a general component framework.

## Colors

The existing sRGB hex palette and primitive/semantic aliases remain in `src/style.css`. Gold has three additional roles for the scoring effect.

| Semantic role    | Implemented value         | Use                                             |
| ---------------- | ------------------------- | ----------------------------------------------- |
| `--page`         | `#faf7ef` / `--cream-50`  | Page and native help dialog                     |
| `--surface`      | `#fff9e9` / `--cream-100` | Telemetry, score, local-best backing and Pause  |
| `--text`         | `#44382f` / `--brown-900` | Body, headings, score                           |
| `--text-muted`   | `#706351` / `--brown-600` | Hints, telemetry labels, footer                 |
| `--scene`        | `#d9ebe0` / `--mint-100`  | Paper sky                                       |
| `--action`       | `#b84e38` / `--coral-600` | Start, Resume, retry and help confirmation      |
| `--action-hover` | `#a7402e` / `--coral-700` | Primary hover                                   |
| `--live`         | `#37634c` / `--mint-700`  | Connected text and status dot                   |
| `--border`       | `#ded9ca` / `--line-warm` | Separators                                      |
| `--focus`        | `#264f74`                 | Three-pixel keyboard outline, five-pixel offset |
| `--gold-surface` | `#f9e5a3`                 | x2 badge background                             |
| `--gold-ink`     | `#624318`                 | x2 label and countdown                          |
| `--gold-ring`    | `#936717`                 | Remaining-time ring                             |

Illustration colors remain separate from action roles: outlines `#4c392e`, cardboard `#f2d68c`, obstacles `#8d6749`, fur `#fff3d7`, cheeks `#eaa06f`, seed-shell wings `#303431`/`#373632`, and parachute `#e99189`/`#fff0d8`. Hills use `#c6ddcb`/`#b7d1bc`; the second title line uses `#53664c`. A Golden Seed uses `#f5c64f` with a static radial gold halo and dark x2 lettering. Its short trail uses `#b98622` at 45% opacity.

Measured sRGB contrast: body/page 10.59:1, muted/surface 5.56:1, green title/mint sky 5.01:1, primary label/coral 4.77:1, connected/mint 5.54:1, focus/mint 6.89:1, focus/cream 8.14:1. The rendered badge colors were extracted in both browser engines and measure 7.18:1 for text; the remaining-time ring measures 4.00:1 against the gold surface. The probe does not establish contrast for every Canvas or translucent-overlay pixel. No dark theme is implemented.

## Typography

One local variable family: **Nunito**, with `ui-rounded`, `Segoe UI`, and `sans-serif` fallbacks. Latin and the existing Vietnamese WOFF2 subset remain in `public/fonts/`, together with the OFL license. The English interface uses **400, 600, and 800** weights; the face declares 400–800 and synthesis is disabled.

| Token             | Size at default text setting | Role                                                |
| ----------------- | ---------------------------- | --------------------------------------------------- |
| `--text-small`    | .875rem / 14px               | Hints, statuses, local best, x2 timer, footer       |
| `--text-body`     | 1rem / 16px                  | Body and actions                                    |
| `--text-emphasis` | 1.25rem / 20px               | Desktop brand/intro, compact telemetry, result best |
| `--text-title`    | 1.75rem / 28px               | Dialog/result heading, compact score                |
| `--text-display`  | 3rem / 48px                  | Desktop score, mobile/medium title                  |
| `--text-hero`     | 4.5rem / 72px                | Desktop title and countdown                         |

Body line-height is 1.5, help text 1.6, headings 1.02–1.2. The title uses −.055em tracking (−.05em on phones); secondary headings use −.02em. Headings balance wrapping. Instructions remain beside their actions. RPM, wind, scores, and countdowns use tabular numerals and English decimal punctuation. The result best is 20px, below the main 28px/48px total. The Canvas x2 mark is bold 14 world units and scales with the unchanged game world.

## Layout

Shared header/main/footer width is `min(1160px, calc(100% - 64px))`, becoming `calc(100% - 28px)` below 650px. Repeated spacing values are 4, 8, 12, 16, 20, 24, 28/30, 32, 40, and 60px. Whitespace and shared edges group elements; cream surfaces identify score/status rather than adding card grids.

- **Above 1000px:** two-column welcome with a 72px title, craft to the right, and source/telemetry in one row. Gameplay has decorative side notes but no wider view of approaching obstacles.
- **At/below 1000px:** the title becomes 48px, header lane metadata disappears, and side notes tighten.
- **At/below 650px:** welcome stacks title, tagline, craft, and action. Telemetry wraps below the source. Header and status can wrap; gameplay side notes disappear. The portrait is 280 × 176px.
- **Phone heights up to 700px:** title becomes 28px, portrait 226 × 134px, and vertical spacing tightens.
- **Landscape heights up to 600px:** the game world fits `calc((100svh - 170px) * .75)`. The optional stage-top row hides; local best remains in the HUD. Telemetry uses a compact row and the wheel is 38 × 40px. Valid readings show Running or Resting; unknown readings retain their full recovery message. The score/x2 stack sits in the space left of the world, leaving the aircraft visible; Pause stays at the far right. Pause and retry retain at least 44px targets.

The world always keeps 480 × 640 logical dimensions and a 3:4 ratio. The HUD and overlays use the surrounding `.game-layout`, independently of Canvas size. `.score-stack` groups the total and best; `.score-cluster` places the optional timer alongside it. The timer is noninteractive and cannot intercept flaps. Narrow screens abbreviate the visible HUD storage note, while its accessible name and title retain “saved on this device.”

Start/retry scroll the mounted game layout into view in a layout effect before the first countdown frame and focus the flight group without a second scroll. Result/pause panels can grow independently of the small world. Enlarged result content has a named, keyboard-focusable scrolling region; Home/End reveal its ends without scrolling the surrounding page. This preserves the earlier compact-screen and scroll-position fixes.

Production checks cover 320×568, 390×844, 768×1024, 1440×1000, 568×320, and 844×390, plus 200% text enlargement at 390×844 and 568×320. These checks are viewport emulation/text reflow, not native-device or browser-native zoom validation.

## Elevation & Depth

The page is flat, with mint hill layers and a little paper texture. Primary actions have a four-pixel solid lower shadow (`#883d2c`) and no border. Only the modal has a soft shadow (`0 15px 60px #2e3f3430`) and a native translucent backdrop. The live strip, score, and gold badge are opaque, shadow-free surfaces. Result/pause overlays retain a recognizable frozen world through translucent cream/mint.

The primary background switches immediately between availability/hover states to avoid intermediate label/background contrast. Only the press transform transitions for 150ms. Existing hover, native disabled, focus, and reduced-motion states remain.

## Shapes

Stage radius: 24px desktop / 20px phone. Telemetry: 14/12px. World viewport: 12/10px. Primary and gold badge: 12px. Local best backing: 6px. Help dialog: 20px. Pause is a 44px circle. Keycaps use a 5px radius with a heavier lower border.

Walls retain straight collision edges; gnaw lines sit inside their solid faces. The original box, braces, pivots, tape, shell wings, and candy wrapper remain editable Canvas paths. The status illustration uses the same dark rounded outlines, cream fur, orange cheeks, honey-brown wheel, and muted green stand. Unknown signal has a crossed connection symbol and no hamster.

## Components

| Pattern and source                                          | Implemented behavior                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.primary`, `.utility` in `style.css`; actions in `App.tsx` | One filled primary action per screen. Start/retry disable when hardware is unavailable. Native buttons, named icon actions, visible focus, hover, and .96 press scale when motion is allowed.                                                                                                                                                                                                                        |
| `Wheel` in `Icons.tsx`; live strip in `App.tsx`             | `state` is `running`, `resting`, or `unknown`; `moving` gates running paws. ACTIVE wheel angle integrates actual RPM × 6 degrees/second without resetting on updates. IDLE never rotates. Unknown has no running/sleeping art. A stable polite status region carries English connection messages. Its text uses the same render-time freshness gate as the illustration, including expiry between poller age checks. |
| `.game-viewport`, `Session`                                 | Focusable named group. Pointer-down or nonrepeated Space flaps; Escape pauses. Secondary contacts/click duplication are ignored. Page gestures are suppressed only on active flight controls.                                                                                                                                                                                                                        |
| `.score-stack`, `.double-badge`                             | One opaque main score with a smaller local best. Gold x2 badge contains a numeric countdown and SVG remaining-time ring; it uses the same active simulation clock as scoring. Activation is announced once, without announcing each timer tick.                                                                                                                                                                      |
| `Flight` in `engine.ts`; `renderGame` in `art.ts`           | Distance-scheduled Golden Seeds replace ordinary seeds. Collision checks precede all pickups/scoring. A pickup sets 960 ticks; all eligible new points then use ×2. Cosmetic trail does not alter physics or hitboxes.                                                                                                                                                                                               |
| `.pause-card`, `.countdown-overlay`                         | Manual/orientation resume is explicit; valid signal recovery starts a new uninterrupted 3→2→1 countdown. All pauses/countdowns freeze world state and power duration.                                                                                                                                                                                                                                                |
| `.result`, `.over-overlay`                                  | One total, smaller local best labelled by device, retry, and honest storage note. No gap/seed breakdown. Retry receives focus and resets the flight and effect.                                                                                                                                                                                                                                                      |
| `.help-dialog`                                              | Native modal with focus containment, Escape/backdrop/dismiss support, and focus return. Instructions explain the x2 duration, refresh, score-only effect, and real wind.                                                                                                                                                                                                                                             |

`prefers-reduced-motion` stops wheel rotation, running paws, and sleeping breathing. It removes parallax, drifting scraps, wing/rock movement, and press transitions; the gold trail remains still relative to the craft. Essential flight and numeric telemetry remain. Breathing normally uses a subtle three-second scale cycle; running paws alternate over 180ms only with positive ACTIVE RPM. Forced colors retains system-colored button boundaries and focus indicators.

## Do's and Don'ts

- Reuse the six type sizes, semantic palette, shared container, and native primary/utility controls. Keep all user-facing copy English and the product name Squeek & Glide.
- Put instructions next to controls and optional explanation behind How to play. Keep the game and main action on the first 390px screen.
- Preserve hardware-only play, status truthfulness, the storage key, fixed physics, world proportions, and immutable distance-spawned gaps. Never turn unknown data into a sleeping hamster.
- Keep one total and a smaller best; use the gold badge solely for the active x2 effect. Do not add currencies, wallets, leaderboards, or a second scoring display.
- Keep runtime artwork/fonts local and regenerate the share card from the same art. Keep fixtures and browser recording exclusively in tests/scripts.
- If a future informational page is needed, start with the shared container, normal English headings, and the existing neutral typography. Do not add another engine, data source, or competing hero above the game.

Coverage, corrected findings, screenshot evidence, and unperformed checks are recorded in `artifacts/validation.md`.
