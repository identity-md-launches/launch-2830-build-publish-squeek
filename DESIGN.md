# Squeek & Glide design

## Overview

A small, cozy flight game for Squeekchain Genesis Code Lane, with a Vietnamese interface. Its visual idea is a cream hamster in a handmade pale-yellow cardboard aircraft against a mint paper landscape. Dark outlines, narrow honey-brown braces, seed-shell wings and a coral candy-wrapper parachute carry the story. The box remains cardboard rather than a wooden crate.

The start screen presents the title, one explanatory sentence, the aircraft and one primary action. Desktop uses two columns; mobile places the art between the title and action. Live hardware status stays visible in every state. The playable world is always portrait 3:4, with desktop side notes serving only as decoration. The HUD and text overlays use the surrounding stage width independently of that world.

Source of truth: `src/style.css`, `src/Icons.tsx`, `src/game/art.ts` and `src/App.tsx`. Artwork uses editable drawing paths, not external illustrations.

## Colors

CSS primitives and semantic aliases live in `src/style.css:23`. The palette deliberately uses sRGB hex values, also used by Canvas paths in `src/game/art.ts`.

| Semantic token | Value / primitive | Use |
| --- | --- | --- |
| `--page` | `#faf7ef` / `--cream-50` | Page and help dialog |
| `--surface` | `#fff9e9` / `--cream-100` | Live signal strip, score background, pause control, primary-action text |
| `--text` | `#44382f` / `--brown-900` | Headings, body copy, scores |
| `--text-muted` | `#706351` / `--brown-600` | Instructions, secondary values, footer |
| `--scene` | `#d9ebe0` / `--mint-100` | Main mint scene |
| `--action` | `#b84e38` / `--coral-600` | One main action per visible state |
| `--action-hover` | `#a7402e` / `--coral-700` | Primary hover |
| `--live` | `#37634c` / `--mint-700` | Connected status, with text and a dot |
| `--border` | `#ded9ca` / `--line-warm` | Footer/metric separators |
| `--focus` | `#264f74` | Three-pixel keyboard focus outline, offset five pixels |

The Canvas sky is `#d9ebe0`; layered hills use `#c6ddcb` and `#b7d1bc`. Art outlines are `#4c392e`, obstacles `#8d6749`, cardboard `#f2d68c`, cream fur `#fff3d7`, cheeks `#eaa06f`, seed shells `#303431` / `#373632`, and the parachute `#e99189` with `#fff0d8` stripes. The second title line is `#53664c`. These are illustration colors, not additional UI action colors.

Measured WCAG contrast pairs: body/page **10.59:1**; secondary/surface **5.56:1**; title-green/sky **5.01:1**; primary text/action **4.77:1**; connected/sky **5.54:1**. The offset focus ring measures **6.89:1** against mint and **8.14:1** against cream. The offset keeps it off the coral fill. The probe excludes text over Canvas; see the explicit coverage limits in `artifacts/validation.md`. No dark theme is implemented.

## Typography

One locally bundled variable family: **Nunito**, with `ui-rounded`, `Segoe UI`, and `sans-serif` fallbacks. Latin and Vietnamese WOFF2 subsets are in `public/fonts/`; the OFL license is included there. `@font-face` declares weights 400–800, while the interface uses only **400, 600 and 800**. Font synthesis is disabled.

| Token | Default size | Roles |
| --- | --- | --- |
| `--text-small` | 14 px / .875 rem | Instructions, signal detail, footer, compact metadata |
| `--text-body` | 16 px / 1 rem | Buttons, standard body copy, mobile brand |
| `--text-emphasis` | 20 px / 1.25 rem | Desktop brand/intro, secondary illustration notes, mobile wind |
| `--text-title` | 28 px / 1.75 rem | Dialog/result titles, desktop wind, compact score |
| `--text-display` | 48 px / 3 rem | Mobile and medium-width hero, large scores |
| `--text-hero` | 72 px / 4.5 rem | Desktop hero and countdown |

Body line-height is 1.5; help instructions use 1.6. Display headings use 1.02 and −.055em tracking (−.05em on mobile). Secondary headings use 1.2 and −.02em. Headings use balanced wrapping, prose uses natural case, and long hints may wrap. `font-variant-numeric: tabular-nums` stabilizes scores and telemetry. RPM is a unit, not an uppercase eyebrow. Vietnamese number formatting uses a comma decimal separator.

## Layout

Shared header/main/footer width: `min(1160px, 100% - 64px)`, becoming `100% - 28px` on phones. Spacing uses a small repeated set: 4, 8, 12, 16, 20, 24, 28/30, 32, 40 and 60 pixels. Larger gaps separate groups; small gaps bind labels to icons or values.

- **Above 1000 px:** two-column start scene, 72 px title, metadata in the header. The live strip places source at the left and numbers at the right.
- **At 1000 px and below:** title becomes 48 px; lane metadata disappears; desktop side notes become smaller.
- **At 650 px and below:** start screen stacks title, intro, aircraft and action. The live strip wraps metrics onto a second row. Header and status can wrap when text grows. Game side notes are hidden. The instruction next to the start control is not repeated in the lower legend.
- **Phone heights up to 700 px:** the title is 28 px on one line where it fits, the portrait becomes 226 × 134 px, and vertical spacing tightens. The product and main action remain visible at 320 × 568.
- **Short landscape:** the game uses a shorter viewport budget; secondary result decoration is reduced to keep controls reachable. Pause/result panels give `.game-layout` a minimum height of `min(460px, 100svh - 84px)`. They use its full width rather than the narrow canvas. An orientation change pauses gameplay and requires fresh data and an explicit continue.

The actual flight canvas has an invariant 480 × 640 coordinate system. CSS fits it to a 3:4 box, capped at 405 px wide and additionally bounded by available `svh`. Resizing does not mutate physics, existing gaps or score. Desktop side scenery does not expose additional gates. The fixed world aspect is essential to fairness.

`.game-layout` is the positioning container for the HUD, countdown, pause and result overlays. The HUD uses three grid columns: score in the center, pause at the trailing edge, with a 12 px minimum gap. The clipped `.game-viewport` contains only the canvas. Overlay cards have automatic block margins and cannot shrink; when text exceeds the available height, the overlay scrolls from an accessible top instead of centering content above its clip edge. The result region is a named keyboard focus target with an inset focus ring and native Home/End scrolling. No global scroll suppression is applied to this text region.

Before the first countdown frame, a layout effect brings the mounted `.game-layout` into view with an immediate nearest-edge scroll adjustment, then focuses the game without another scroll. Start, retry and resumed countdowns share this positioning. Physics coordinates and the canvas aspect ratio stay unchanged.

Checked rendered widths: 320, 390, 568, 768, 844 and 1440 CSS px; portrait/landscape transition at 390 × 844 to 844 × 390; 200% root text enlargement at 390 × 844 and 568 × 320. This is not a claim of native browser zoom or physical-device verification.

## Elevation & Depth

The page is mostly flat. A mint scene and two quieter hill layers provide depth. The primary button has a four-pixel solid lower shadow (`#883d2c`) for a paper-like press surface, with no border. The modal alone uses a soft shadow (`0 15px 60px #2e3f3430`) and a dark translucent native backdrop. Structure uses separators instead of nested bordered cards.

Gameplay overlays are translucent mint or cream so the frozen world is still recognizable. The live strip is an opaque cream surface with no shadow. Gameplay animations use simulation time and stop when interrupted. The wheel uses valid measured RPM and real frame elapsed time, independent of the smoothed flight speed.

## Shapes

Scene radius: 24 px desktop / 20 px phone. Live strip: 14 / 12 px. Flight viewport: 12 / 10 px. Primary buttons: 12 px. Help dialog: 20 px. The pause button is circular and 44 × 44 px. Keyboard keycaps have a 5 px radius with a heavier bottom border. SVG icons use consistent round strokes; art outlines are deliberately stronger and handmade.

Walls keep straight collision edges. Gnaw marks are printed inside their shape. Wings are dark, cream-edged watermelon-seed shells; the far wing is behind the hamster. Narrow wooden braces, round pivots, string ties, crossed tape and a mint star distinguish the pale cardboard body. The striped, serrated candy wrapper unfolds into an asymmetrical four-string canopy; there are no leaf wings or leaf parachutes.

## Components

| Pattern / source | Behavior and states |
| --- | --- |
| `.primary` in `style.css`; actions in `App.tsx` | Filled coral start/retry/continue/confirm action. 56 px minimum desktop, 52 px phone. Native disabled state for unavailable hardware. Hover changes only background; press scales to .96 when motion is allowed. |
| `.utility`, `Icon`, `BrandMark` in `Icons.tsx` | Header help and dismiss actions. Named native buttons, 44 px comfortable targets, decorative SVGs hidden from assistive technology. Brand is static, not a misleading home control. |
| `.live-strip`, `Wheel` in `App.tsx` / `Icons.tsx` | Real status text, measured RPM and smoothed in-flight multiplier. Unusable readings display an unavailable mark instead of invented zero RPM. A stable polite live region announces connection changes. |
| `.game-viewport` and `Session` | Focusable named group with active-game Space/Escape handling. Pointer-down only; secondary contacts and key repeat ignored. Page gestures are prevented only on active game controls. Score has an opaque cream backing and a named output; only important lifecycle changes are announced. |
| `.pause-card`, `.countdown-overlay` | Frozen scene explanation or 3→2→1 readiness cue. Manual/orientation resume is explicit; network/visibility recovery is automatic after validation. |
| `.result`, `.over-overlay` | Final score, local best, passed pairs, collected seeds, prominent retry, honest local-storage note. The stage-sized overlay scrolls vertically with enlarged text; Shift+Tab from retry focuses its named region for keyboard scrolling. Retry receives focus and resets the whole run. |
| `.help-dialog` | Native modal `dialog` with a labelled heading, native focus containment, Escape/dismiss support and focus return. Opening help preserves prior manual pause state. |
| `drawCraft`, `drawScenery`, `renderGame` in `art.ts` | Original artwork with simulation-driven flap, pitch, hamster bob, wind details, parallax, scraps and parachute. No independent animation timer can keep gameplay moving during a signal pause. |

`prefers-reduced-motion` disables CSS press transitions and removes parallax, scraps, wing/bob/rock motion and wheel rotation. Essential flight movement and numeric RPM remain. The preference is read at drawing time, including on WebKit, and the cosmetic end sequence shortens. Forced-colors styles restore system-colored button boundaries and focus indicators.

## Do's and Don'ts

- Reuse the existing typography roles, semantic colors, header/main width and primary button. Keep one obvious main action in the current state.
- Keep user-facing text Vietnamese, concise, correctly accented and adjacent to its control. Status must use words as well as color.
- Keep essential runtime assets local, and regenerate the share image from the same source art after a significant visual change.
- Preserve the hardware-only start gate, immutable gaps, fixed vertical physics, distance-based spawning and equal world proportions. Review simulation tests before changing geometry.
- Keep optional explanation behind the existing help control; avoid adding a landing-page hero above the game or a card grid around it.
- If an informational page is later needed, reuse the page container, one heading scale and neutral text styles. It must not add a second flight engine, data source or mock-speed mode.
