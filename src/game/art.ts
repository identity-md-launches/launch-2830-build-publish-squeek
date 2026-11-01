import { WORLD } from "./config";
import type { Session } from "./engine";
const ink = "#4c392e";
function path(
  c: CanvasRenderingContext2D,
  d: string,
  fill: string | null,
  stroke = ink,
  width = 2.4,
) {
  const p = new Path2D(d);
  if (fill) {
    c.fillStyle = fill;
    c.fill(p);
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke(p);
  }
}
function ellipse(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  stroke = "",
  width = 2,
) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke();
  }
}
function line(c: CanvasRenderingContext2D, d: string, color = ink, width = 2) {
  path(c, d, null, color, width);
}
function round(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke = ink,
  width = 2,
) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.lineWidth = width;
    c.strokeStyle = stroke;
    c.stroke();
  }
}
export function drawSeed(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1,
) {
  c.save();
  c.translate(x, y);
  c.rotate(0.35);
  c.scale(scale, scale);
  path(c, "M0 -13 C15 -4 12 11 0 15 C-12 9 -13 -4 0 -13Z", "#e3b961", ink, 1.8);
  line(c, "M0 -9 C4 -1 4 7 0 11", "#fff0ba", 2.3);
  line(c, "M-3 -5 L-5 4", "#a9793d", 1.2);
  c.restore();
}
/** Original Canvas vector artwork. All moving parts share the simulation's clock. */
export function drawCraft(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  flap = 1,
  wind = 1,
  parachute = 0,
  rock = 0,
) {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  c.lineCap = "round";
  c.lineJoin = "round";
  const wing = Math.sin(Math.min(flap / 0.24, 1) * Math.PI) * 0.65;
  c.rotate(parachute > 0 ? rock : -0.08 - wing * 0.08);
  if (parachute > 0) {
    c.save();
    c.translate(0, -14);
    c.scale(1, Math.max(0.08, parachute));
    // Four strings, the skewed wrapper canopy and its serrated ends.
    line(
      c,
      "M-77 -91 L-36 30 M-39 -112 L-20 31 M31 -116 L23 31 M76 -97 L38 28",
      "#785e47",
      1.5,
    );
    path(
      c,
      "M-78 -90 C-79 -157 54 -169 79 -99 L87 -103 L84 -91 L76 -94 Q58 -103 41 -98 Q17 -109 -3 -98 Q-28 -106 -48 -95 Q-65 -99 -78 -90 L-87 -89 L-83 -98Z",
      "#e99189",
      ink,
      2.5,
    );
    path(
      c,
      "M-51 -137 Q-25 -154 -15 -151 Q-32 -129 -28 -101 L-42 -98 Q-48 -117 -51 -137Z",
      "#fff0d8",
      "",
      0,
    );
    path(
      c,
      "M10 -153 Q27 -155 38 -147 Q48 -130 48 -100 L35 -100 Q35 -131 10 -153Z",
      "#fff0d8",
      "",
      0,
    );
    line(c, "M-78 -90 C-79 -157 54 -169 79 -99", ink, 2.5);
    line(c, "M-70 -98 L-68 -105 M70 -104 L68 -111", "#bb6963", 1.3);
    c.restore();
  }
  // Far wing: visibly a black, cream-edged seed shell, not a leaf.
  c.save();
  c.translate(25, 7);
  c.rotate(-wing * 0.9);
  path(c, "M0 1 Q11 -29 58 -36 Q56 -1 2 12Z", "#373632", "#faeac4", 3);
  line(c, "M4 7 Q25 -12 49 -27", "#726d58", 1.4);
  c.restore();
  // Wooden tail fin and string.
  path(c, "M-38 13 L-62 1 L-59 29 L-39 26Z", "#bd8b50");
  line(c, "M-57 10 L-45 17 M-55 20 L-44 23", "#8c6039", 1.2);
  // Open rim behind hamster.
  path(c, "M-42 3 L30 -1 L44 11 L-37 15Z", "#b08a51");
  // Ears trail backwards in stronger wind.
  c.save();
  c.translate(-17, -45);
  c.rotate(-(wind - 1) * 0.2);
  ellipse(c, 0, 0, 12, 14, "#fff0ce", ink, 2.5);
  ellipse(c, -1, 1, 7, 8, "#efb4a0");
  c.restore();
  c.save();
  c.translate(19, -44);
  c.rotate(-(wind - 1) * 0.17);
  ellipse(c, 0, 0, 11, 13, "#fff0ce", ink, 2.5);
  ellipse(c, 0, 1, 6, 7, "#efb4a0");
  c.restore();
  // Cream hamster, orange cheeks, little face.
  c.save();
  c.translate(0, -wing * 3);
  path(
    c,
    "M-27 -29 Q-30 -48 -9 -50 Q13 -53 27 -33 Q38 -27 34 -8 Q29 10 0 10 Q-32 10 -34 -8 Q-37 -22 -27 -29Z",
    "#fff3d7",
  );
  path(
    c,
    "M-30 -13 Q-18 -19 -10 -6 Q0 -14 11 -9 Q24 -20 32 -10 Q28 8 0 8 Q-26 7 -30 -13Z",
    "#fff9e9",
    "",
    0,
  );
  ellipse(c, -24, -8, 9, 6, "#eaa06f");
  ellipse(c, 24, -10, 8, 6, "#eaa06f");
  ellipse(c, -12, -23, parachute ? 4.1 : 3, parachute ? 5 : 3.9, ink);
  ellipse(c, 17, -24, parachute ? 4.1 : 3, parachute ? 5 : 3.9, ink);
  ellipse(c, -13, -24, 1, 1.1, "#ffffff");
  ellipse(c, 16, -25, 1, 1.1, "#ffffff");
  path(c, "M0 -17 Q4 -20 7 -17 L3 -13Z", "#bf7d71", "", 0);
  line(c, "M3 -13 L3 -10 M3 -10 Q-1 -5 -4 -10 M3 -10 Q8 -6 10 -11", ink, 1.4);
  line(
    c,
    "M-29 -14 L-39 -16 M-28 -9 L-38 -7 M28 -15 L39 -19 M30 -10 L41 -10",
    "#8f7059",
    1,
  );
  c.restore();
  // Main body is pale cardboard; braces are narrow popsicle sticks.
  path(c, "M-42 8 L42 8 L35 42 L-35 40Z", "#f2d68c");
  path(c, "M-42 8 L-31 14 L-26 39 L-35 40Z", "#deba73", "", 0);
  path(c, "M-39 8 L-40 1 L-14 3 L-12 9 M13 7 L16 1 L42 5 L43 11", "#fbe4a3");
  path(c, "M-9 10 L1 11 L6 39 L-3 40Z", "#fff0b7", "", 0);
  path(c, "M-29 19 L32 25 L30 33 L-30 27Z", "#fff0b7", "", 0);
  // Bite impressions are inset decorative lines, not misleading collision boundaries.
  line(c, "M16 9 Q18 15 21 10 Q23 14 26 10", "#9d7a48", 1.3);
  line(c, "M-19 33 Q-17 30 -15 33 Q-12 30 -10 33", "#b48f51", 1.1);
  // Two warm wooden braces and simple grain.
  c.save();
  c.translate(-29, 26);
  c.rotate(-0.22);
  round(c, -3, -15, 7, 30, 3, "#c18c4b", ink, 1.5);
  line(c, "M0 -10 L0 9 M2 -4 L2 4", "#986636", 0.8);
  c.restore();
  c.save();
  c.translate(31, 26);
  c.rotate(0.18);
  round(c, -3, -15, 7, 30, 3, "#c18c4b", ink, 1.5);
  line(c, "M0 -10 L0 9 M2 -4 L2 4", "#986636", 0.8);
  c.restore();
  line(
    c,
    "M-35 16 L-25 15 M-35 19 L-24 18 M28 15 L37 17 M27 18 L37 20",
    "#f8edcc",
    1.6,
  );
  // Mint star patch.
  path(
    c,
    "M18 18 L20 23 L26 23 L22 27 L23 33 L18 30 L13 33 L14 27 L10 23 L16 23Z",
    "#98bda5",
    "#577866",
    1.2,
  );
  // Front paws grip the box.
  ellipse(c, -18, 7, 7, 5, "#fff2d4", ink, 1.6);
  ellipse(c, 17, 7, 7, 5, "#fff2d4", ink, 1.6);
  line(
    c,
    "M-20 7 L-20 10 M-16 7 L-16 10 M15 7 L15 10 M19 7 L19 10",
    "#b19573",
    0.9,
  );
  // Near seed-shell wing, round wooden pivot.
  c.save();
  c.translate(-17, 23);
  c.rotate(wing);
  path(
    c,
    "M0 0 Q-20 -32 -65 -28 Q-64 0 -36 7 Q-17 12 0 7Z",
    "#303431",
    "#f9eac5",
    3,
  );
  line(c, "M-5 4 Q-30 -2 -56 -21", "#7c7a67", 1.5);
  c.restore();
  ellipse(c, -16, 24, 5.2, 5.2, "#c38e4a", ink, 1.5);
  ellipse(c, -16, 24, 1.3, 1.3, "#735135");
  // Loose tape and the folded, serrated candy wrapper.
  const tail = (wind - 1) * 9;
  path(
    c,
    `M-35 31 Q-48 ${28 - tail} -57 ${35 - tail} L-59 ${41 - tail} L-55 ${40 - tail} L-53 ${43 - tail} Q-44 35 -35 36Z`,
    "#f8e6b0",
    "#a58a55",
    1,
  );
  if (!parachute) {
    path(
      c,
      "M-37 27 L-45 24 L-44 29 L-48 31 L-44 34 L-46 38 L-37 35 L-31 36 L-27 33 L-32 29Z",
      "#e99189",
      ink,
      1,
    );
    line(c, "M-39 28 L-37 34 M-35 29 L-33 34", "#fff1dd", 2);
  }
  c.restore();
}
export function drawScenery(
  c: CanvasRenderingContext2D,
  w: number,
  h: number,
  distance = 0,
  reduced = false,
) {
  c.fillStyle = "#d9ebe0";
  c.fillRect(0, 0, w, h);
  const parallax = reduced ? 0 : distance * 0.13;
  c.lineCap = "round";
  // Sparse flecks give the paper a little tooth without a bitmap texture.
  c.fillStyle = "#c5dccd";
  for (let i = 0; i < 180; i++) {
    const x = (i * 137.73) % w,
      y = (i * 79.31) % h;
    c.fillRect(x, y, 1, 1);
  }
  ellipse(c, w * 0.76, h * 0.18, 39, 39, "#f5edc9");
  const cloud = (x: number, y: number, s: number) => {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    path(
      c,
      "M0 18 Q-6 4 13 2 Q17 -19 38 -7 Q54 -20 64 1 Q87 -1 85 18Z",
      "#edf4e9",
      "",
      0,
    );
    line(c, "M7 22 L68 22", "#c4dacb", 1.2);
    c.restore();
  };
  cloud(
    ((((w * 0.15 - parallax * 0.8) % (w + 220)) + w + 220) % (w + 220)) - 80,
    h * 0.16,
    1.2,
  );
  cloud(
    ((((w * 0.72 - parallax * 0.5) % (w + 220)) + w + 220) % (w + 220)) - 80,
    h * 0.36,
    0.8,
  );
  cloud(
    ((((w * 0.48 - parallax) % (w + 220)) + w + 220) % (w + 220)) - 80,
    h * 0.63,
    0.6,
  );
  path(
    c,
    `M0 ${h * 0.85} Q${w * 0.18} ${h * 0.71} ${w * 0.37} ${h * 0.87} Q${w * 0.65} ${h * 0.68} ${w} ${h * 0.86} L${w} ${h} L0 ${h}Z`,
    "#c6ddcb",
    "",
    0,
  );
  path(
    c,
    `M0 ${h * 0.94} Q${w * 0.27} ${h * 0.78} ${w * 0.52} ${h * 0.94} Q${w * 0.8} ${h * 0.84} ${w} ${h * 0.92} L${w} ${h} L0 ${h}Z`,
    "#b7d1bc",
    "",
    0,
  );
  // Tiny paper villages in the far distance.
  for (let i = 0; i < 5; i++) {
    const x =
      ((((i * 183 + 70 - parallax * 0.35) % (w + 100)) + w + 100) % (w + 100)) -
      50;
    const y = h * 0.91;
    path(
      c,
      `M${x} ${y} L${x} ${y - 22} L${x + 12} ${y - 32} L${x + 24} ${y - 22} L${x + 24} ${y}Z`,
      "#a9c5ad",
      "",
      0,
    );
    c.fillStyle = "#d4e2c6";
    c.fillRect(x + 9, y - 18, 5, 7);
  }
  c.fillStyle = "#acc8b1";
  c.fillRect(0, h - 5, w, 5);
}
function drawWall(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  bottom: boolean,
) {
  if (height <= 0) return;
  c.save();
  c.translate(x, y);
  round(c, 0, 0, WORLD.gateWidth, height, 2, "#8d6749", ink, 2.5);
  c.fillStyle = "#a57d57";
  c.fillRect(7, 1, 9, height - 2);
  c.fillStyle = "#79573f";
  c.fillRect(WORLD.gateWidth - 9, 1, 7, height - 2);
  for (let j = 20; j < height - 15; j += 32)
    line(c, `M21 ${j} L36 ${j + 2} M42 ${j - 8} L48 ${j - 7}`, "#b58a5f", 1);
  const edge = bottom ? 0 : height - 10;
  round(c, -2, edge, WORLD.gateWidth + 4, 10, 2, "#b28a5c", ink, 2);
  for (let j = 4; j < 62; j += 8)
    line(c, `M${j} ${edge + 3} L${j + 2} ${edge + 7}`, "#755337", 1);
  // Gnaw marks are printed inside the solid wall, never cutouts in a collision edge.
  const gy = bottom ? 27 : height - 31;
  line(c, `M37 ${gy} q3 -6 5 -1 q3 -6 5 -1 q3 -6 5 -1`, "#5d422f", 1.5);
  c.restore();
}
export function renderGame(
  c: CanvasRenderingContext2D,
  session: Session,
  reduced: boolean,
) {
  const f = session.flight;
  drawScenery(c, WORLD.width, WORLD.height, f.distance, reduced);
  for (const gate of f.gates) {
    const x = gate.worldX - f.distance;
    if (x > WORLD.width + 80) continue;
    drawWall(c, x, 0, gate.center - gate.gap / 2, false);
    drawWall(
      c,
      x,
      gate.center + gate.gap / 2,
      WORLD.height - gate.center - gate.gap / 2,
      true,
    );
    if (gate.seed && !gate.collected)
      drawSeed(c, x + WORLD.gateWidth / 2, gate.seedY, 0.85);
  }
  if (!reduced)
    for (let i = 0; i < 4; i++) {
      const x = ((i * 139 + f.distance * 0.3) % 560) - 40;
      const y = 140 + i * 117;
      c.save();
      c.translate(WORLD.width - x, y);
      c.rotate(i + f.time * 0.15);
      c.fillStyle = i % 2 ? "#dfb77a" : "#f2d6b3";
      c.fillRect(-3, -1, 7, 3);
      c.restore();
    }
  const crashed = session.phase === "crashed" || session.phase === "over";
  const p = crashed ? Math.min(1, session.crashTime / 0.6) : 0;
  // Cosmetic descent may leave the bottom edge; it never lifts a crashed box.
  const safeY = Math.max(180, session.crashY);
  const crashY =
    session.crashY +
    (safeY - session.crashY) * Math.min(1, session.crashTime / 0.55) +
    Math.min(session.crashTime, 1.8) * 8;
  const y = crashed ? crashY : f.y;
  if (f.wind > 1.3 && !crashed && !reduced) {
    line(
      c,
      `M${WORLD.playerX - 66} ${y - 20} l-21 0 M${WORLD.playerX - 78} ${y} l-30 0 M${WORLD.playerX - 67} ${y + 19} l-17 0`,
      "#8eb19b",
      1.5,
    );
  }
  drawCraft(
    c,
    WORLD.playerX,
    y,
    0.7,
    reduced ? 1 : f.flapAge,
    f.wind,
    p,
    reduced ? 0 : Math.sin(session.crashTime * 5) * 0.09,
  );
}
