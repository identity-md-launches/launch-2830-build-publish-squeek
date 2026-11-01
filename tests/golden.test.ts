import test from "node:test";
import assert from "node:assert/strict";
import { Flight, Session, type Gate } from "../src/game/engine";
import { WORLD } from "../src/game/config";
const pickup = (overrides: Partial<Gate> = {}): Gate => ({
  index: 11,
  worldX: WORLD.playerX - WORLD.gateWidth / 2,
  center: 320,
  gap: 250,
  passed: false,
  seed: false,
  golden: true,
  collected: false,
  seedY: 320,
  ...overrides,
});
function activate(f = new Flight(() => 0.5)) {
  f.gates = [pickup()];
  f.advance(WORLD.step, 1);
  assert.equal(f.doubleRemaining, 8);
  return f;
}
function step(f: Flight) {
  // Isolate the clock from later collectible spawns without changing physics.
  for (const g of f.gates) {
    g.seed = false;
    g.golden = false;
  }
  if (f.y > 320 && f.velocity >= 0) f.flap();
  f.advance(WORLD.step, 1);
  assert.ok(f.alive);
}
test("Golden Seed schedule: first pair 11–18, then 6–8; immutable, distance based and replaces ordinary seed", () => {
  const starts = new Set<number>(),
    intervals = new Set<number>();
  for (let seed = 1; seed <= 24; seed++) {
    let n = seed * 100000,
      first = true;
    const f = new Flight(() => {
      if (first) {
        first = false;
        return (seed % 8) / 8;
      }
      n = (1664525 * n + 1013904223) >>> 0;
      return n / 4294967296;
    });
    f.wind = 2.2;
    const seen = new Map<number, string>();
    let last = 0,
      count = 0;
    while (f.alive && f.passed < 130) {
      for (const g of f.gates) {
        const stable = JSON.stringify([g.worldX, g.golden, g.seed, g.seedY]);
        if (seen.has(g.index)) {
          assert.equal(stable, seen.get(g.index));
          continue;
        }
        seen.set(g.index, stable);
        assert.equal(
          g.worldX,
          WORLD.firstGateX + (g.index - 1) * WORLD.spacing,
        );
        if (g.index <= 10) assert.equal(g.golden, false);
        if (g.golden) {
          if (!last) {
            assert.ok(g.index >= 11 && g.index <= 18);
            starts.add(g.index);
          } else {
            assert.ok(g.index - last >= 6 && g.index - last <= 8);
            intervals.add(g.index - last);
          }
          assert.equal(g.seed, false);
          assert.equal(Math.abs(g.seedY - g.center), 24);
          assert.ok(
            g.gap / 2 - Math.abs(g.seedY - g.center) - WORLD.halfHeight >= 35,
          );
          last = g.index;
          count++;
        }
      }
      const next = f.gates.find(
        (g) =>
          g.worldX - f.distance + WORLD.gateWidth >=
          WORLD.playerX - WORLD.halfWidth,
      );
      const target = next?.golden ? next.seedY : (next?.center ?? 320);
      if (f.y > target + 5 && f.velocity >= 0) f.flap();
      f.advance(1 / 120, 2.2);
    }
    assert.ok(
      f.alive,
      `Golden Seed route must remain reachable at max wind: ${seed}/${f.passed}`,
    );
    assert.ok(count >= 15);
  }
  assert.equal(starts.size, 8);
  assert.deepEqual([...intervals].sort(), [6, 7, 8]);
});
test("pickup has no points, is consumed once, and lasts exactly 960 subsequent active steps", () => {
  const f = activate();
  assert.equal(f.score, 0);
  assert.equal(f.seeds, 0);
  assert.equal(f.gates[0].collected, true);
  for (let i = 0; i < 959; i++) step(f);
  assert.equal(f.doubleRemaining, WORLD.step);
  step(f);
  assert.equal(f.doubleRemaining, 0);
  assert.equal(f.time > 8, true);
});
test("Golden Seed activates before all same-step pair/ordinary points, without multiplying prior points", () => {
  const f = new Flight(() => 0.5);
  f.score = 9;
  f.gates = [
    pickup({ golden: false, worldX: 40, seed: false, index: 1 }),
    pickup({ golden: false, seed: true, index: 2 }),
    pickup(),
  ];
  f.advance(WORLD.step, 1);
  assert.equal(f.score, 13);
  assert.equal(f.doubleRemaining, 8);
  f.advance(WORLD.step, 1);
  assert.equal(f.score, 13);
});
test("another Golden Seed refreshes to eight seconds, without stacking or direct points", () => {
  const f = activate();
  for (let i = 0; i < 120; i++) step(f);
  assert.equal(f.doubleRemaining, 7);
  f.y = 320;
  f.velocity = 0;
  f.gates = [
    pickup({ worldX: f.distance + WORLD.playerX - WORLD.gateWidth / 2 }),
  ];
  const score = f.score;
  f.advance(WORLD.step, 1);
  assert.equal(f.doubleRemaining, 8);
  assert.equal(f.score, score);
  f.advance(WORLD.step, 1);
  assert.equal(f.doubleRemaining, 8 - WORLD.step);
});
test("expiration restores +1 on both pair and ordinary seed", () => {
  const f = activate();
  for (let i = 0; i < 960; i++) step(f);
  f.y = 320;
  f.velocity = 0;
  f.gates = [
    pickup({
      golden: false,
      seed: true,
      worldX: f.distance + WORLD.playerX - WORLD.gateWidth / 2,
    }),
    pickup({ golden: false, worldX: f.distance + 40 }),
  ];
  const before = f.score;
  f.advance(WORLD.step, 1);
  assert.equal(f.score - before, 2);
});
test("collision wins over pickup and every kind of scoring; death clears the effect", () => {
  for (const powered of [false, true]) {
    const f = powered ? activate() : new Flight(() => 0.5);
    f.y = WORLD.halfHeight;
    f.velocity = -1;
    f.gates = [pickup({ seedY: f.y }), pickup({ golden: false, worldX: 40 })];
    const before = f.score;
    f.advance(WORLD.step, 1);
    assert.equal(f.alive, false);
    assert.equal(f.score, before);
    assert.equal(f.doubleRemaining, 0);
    assert.equal(f.gates[0].collected, false);
    f.advance(60, 2.2);
    assert.equal(f.score, before);
  }
});
test("x2 affects only points: powered and unpowered flights have identical physics and collisions", () => {
  const a = activate(),
    b = new Flight(() => 0.5);
  b.gates = [pickup({ golden: false })];
  b.advance(WORLD.step, 1);
  for (let i = 0; i < 300; i++) {
    if (a.y > 320 && a.velocity >= 0) {
      a.flap();
      b.flap();
    }
    a.advance(WORLD.step, 2.2);
    b.advance(WORLD.step, 2.2);
    assert.deepEqual(
      [a.y, a.velocity, a.wind, a.distance, a.alive],
      [b.y, b.velocity, b.wind, b.distance, b.alive],
    );
  }
});
test("manual/help/orientation, signal loss, hidden tabs and every countdown freeze x2; retry resets", () => {
  const s = new Session();
  s.setAvailability(true);
  s.start();
  s.countdown = null;
  s.flight = activate();
  for (const reason of ["manual", "help", "orientation"] as const) {
    s.pause(reason);
    s.update(90, 2.2);
    assert.equal(s.flight.doubleRemaining, 8);
    s.resume();
    s.update(2.99, 2.2);
    assert.equal(s.flight.doubleRemaining, 8);
    s.update(0.02, 2.2);
    assert.equal(s.countdown, null);
    assert.equal(s.flight.doubleRemaining, 8);
  }
  for (const hidden of [false, true]) {
    s.setAvailability(false, hidden);
    s.update(90, 2.2);
    assert.equal(s.flight.doubleRemaining, 8);
    s.setAvailability(true, false);
    assert.equal(s.countdown, 3);
    s.update(3, 2.2);
    assert.equal(s.flight.doubleRemaining, 8);
  }
  s.update(WORLD.step, 1);
  assert.equal(s.flight.doubleRemaining, 8 - WORLD.step);
  assert.equal(s.start(), true);
  assert.equal(s.flight.doubleRemaining, 0);
  assert.equal(s.flight.score, 0);
  assert.equal(s.countdown, 3);
});
