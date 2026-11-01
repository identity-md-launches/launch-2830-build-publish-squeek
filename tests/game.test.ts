import test from "node:test";
import assert from "node:assert/strict";
import { Flight, Session, readBest, saveBest } from "../src/game/engine";
import { WORLD, WIND, windFor, gapFor } from "../src/game/config";
function random(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function pilot(f: Flight, dt: number, targetWind = 2.2) {
  const next = f.gates.find(
    (g) =>
      g.worldX - f.distance + WORLD.gateWidth >=
      WORLD.playerX - WORLD.halfWidth,
  );
  const target = next?.center ?? 320;
  if (f.y > target + 5 && f.velocity >= 0) f.flap();
  f.advance(dt, targetWind);
}
test("RPM alone determines wind; IDLE is minimum even with nonzero measured RPM", () => {
  assert.equal(windFor(0), 1);
  assert.equal(windFor(60), 1.6);
  assert.equal(windFor(120), 2.2);
  assert.equal(windFor(900), 2.2);
  assert.equal(windFor(-5), 1);
  assert.equal(windFor(80, true), 1);
});
test("first ten gaps wide, new gaps 11–30 narrow gradually, then stay fixed", () => {
  for (let i = 1; i <= 10; i++) assert.equal(gapFor(i), 250);
  for (let i = 11; i <= 30; i++) assert.ok(gapFor(i) < gapFor(i - 1));
  assert.equal(gapFor(30), 184);
  assert.equal(gapFor(10000), 184);
});
test("thousands of generated gaps remain safely reachable at maximum speed, including extreme alternating shifts", () => {
  let total = 0;
  const generators = [
    ...Array.from({ length: 12 }, (_, i) => random(i + 1)),
    () => 0,
    () => 1,
  ];
  let sign = 0;
  generators.push(() => ((sign++ >> 1) % 2 ? 1 : 0));
  for (const rng of generators) {
    const f = new Flight(rng);
    f.wind = WIND.max;
    while (f.alive && f.passed < 300) {
      pilot(f, 1 / 60);
    }
    assert.equal(
      f.alive,
      true,
      `crash after ${f.passed} gates, y=${f.y}, next=${JSON.stringify(f.gates[0])}`,
    );
    assert.equal(f.passed, 300);
    total += f.passed;
  }
  assert.equal(total, 4500);
});
test("seed clearance, immutable gaps, distance spacing and max center change", () => {
  const f = new Flight(random(29));
  f.wind = 2.2;
  let previousCenter = 320;
  let previousX = 310;
  const seen = new Map<number, string>();
  while (f.alive && f.passed < 100) {
    for (const g of f.gates) {
      if (!seen.has(g.index)) {
        assert.ok(
          Math.abs(g.center - previousCenter) <= WORLD.maxCenterDelta + 1e-9,
        );
        assert.equal(g.worldX - previousX, WORLD.spacing);
        assert.ok(
          g.gap / 2 - Math.abs(g.seedY - g.center) - WORLD.halfHeight >=
            35 - 1e-8,
        );
        previousCenter = g.center;
        previousX = g.worldX;
        seen.set(g.index, JSON.stringify([g.gap, g.center, g.seedY, g.worldX]));
      } else
        assert.equal(
          JSON.stringify([g.gap, g.center, g.seedY, g.worldX]),
          seen.get(g.index),
        );
    }
    pilot(f, 1 / 30);
  }
  assert.ok(f.alive);
  assert.equal(f.passed, 100);
});
test("constant flap impulse/gravity; transition reaches 95% of new wind after about 2 seconds", () => {
  for (const speed of [1, 2.2]) {
    const f = new Flight();
    f.wind = speed;
    f.flap();
    assert.equal(f.velocity, -250);
    f.advance(WORLD.step, speed);
    assert.equal(f.velocity, -244);
  }
  const f = new Flight(() => 0.5);
  for (let i = 0; i < 240; i++) {
    if (f.y > 320 && f.velocity >= 0) f.flap();
    f.advance(WORLD.step, 2.2);
  }
  assert.ok(f.wind > 2.13 && f.wind < 2.16);
  assert.equal(f.score, 0);
});
test("fixed substeps catch collision during long frames, before collecting a seed or scoring", () => {
  const f = new Flight();
  f.wind = 2.2;
  f.y = 200;
  f.gates = [
    {
      index: 1,
      worldX: WORLD.playerX + WORLD.halfWidth + 8,
      center: 400,
      gap: 184,
      passed: false,
      seed: true,
      collected: false,
      seedY: 200,
    },
  ];
  f.advance(0.25, 2.2);
  assert.equal(f.alive, false);
  assert.equal(f.score, 0);
  const snapshot = JSON.stringify(f);
  f.flap();
  f.advance(20, 2.2);
  assert.equal(JSON.stringify(f), snapshot);
});
test("pair and seed award exactly once; boundaries end scoring immediately", () => {
  const f = new Flight();
  f.y = 320;
  f.gates = [
    {
      index: 1,
      worldX: WORLD.playerX - WORLD.gateWidth / 2,
      center: 320,
      gap: 250,
      passed: false,
      seed: true,
      collected: false,
      seedY: 320,
    },
  ];
  f.advance(WORLD.step, 1);
  assert.equal(f.score, 1);
  assert.equal(f.seeds, 1);
  for (let i = 0; i < 90 && f.alive; i++) {
    if (f.y > 320 && f.velocity > 0) f.flap();
    f.advance(WORLD.step, 1);
  }
  assert.equal(f.passed, 1);
  assert.equal(f.score, 2);
  f.y = WORLD.halfHeight;
  f.flap();
  f.advance(WORLD.step, 1);
  assert.equal(f.alive, false);
  assert.equal(f.score, 2);
});
test("signal loss freezes all run state and countdown; recovery requires uninterrupted three seconds", () => {
  const s = new Session();
  assert.equal(s.start(), false);
  s.setAvailability(true);
  s.start();
  for (let i = 0; i < 12; i++) s.update(0.25, 1);
  assert.equal(s.countdown, null);
  s.update(0.1, 1);
  s.setAvailability(false);
  const snapshot = JSON.stringify(s.flight);
  for (let i = 0; i < 100; i++) {
    s.flap();
    s.update(0.25, 2.2);
  }
  assert.equal(JSON.stringify(s.flight), snapshot);
  s.setAvailability(true);
  assert.equal(s.countdown, 3);
  s.update(0.25, 2.2);
  s.setAvailability(false);
  assert.equal(s.countdown, null);
  s.setAvailability(true);
  assert.equal(s.countdown, 3);
  for (let i = 0; i < 11; i++) s.update(0.25, 2.2);
  assert.equal(JSON.stringify(s.flight), snapshot);
  s.update(0.25, 2.2);
  assert.equal(s.countdown, null);
  assert.equal(JSON.stringify(s.flight), snapshot);
  s.update(0.02, 2.2);
  assert.ok(s.flight.distance > 0);
});
test("hidden tabs, orientation and manual pauses discard time; retry resets run", () => {
  const s = new Session();
  s.setAvailability(true);
  s.start();
  s.countdown = null;
  s.flight.score = 12;
  s.flight.seeds = 3;
  s.flight.flap();
  s.update(0.05, 2.2);
  s.setAvailability(false, true);
  s.update(60, 2.2);
  const distance = s.flight.distance;
  s.setAvailability(true, false);
  assert.equal(s.countdown, 3);
  s.pause("orientation");
  s.update(60, 2.2);
  assert.equal(s.flight.distance, distance);
  s.resume();
  assert.equal(s.countdown, 3);
  s.start();
  assert.equal(s.flight.score, 0);
  assert.equal(s.flight.seeds, 0);
  assert.equal(s.flight.distance, 0);
  assert.equal(s.flight.velocity, 0);
  assert.equal(s.flight.wind, 1);
  assert.equal(s.crashTime, 0);
  assert.equal(s.pauseReason, null);
});
test("parachute is cosmetic, freezes on bad signal, never resurrects flight", () => {
  const s = new Session();
  s.setAvailability(true);
  s.start();
  s.countdown = null;
  s.flight.y = 638;
  s.update(0.02, 1);
  assert.equal(s.phase, "crashed");
  const score = s.flight.score;
  s.setAvailability(false);
  s.update(0.25, 2.2);
  assert.equal(s.crashTime, 0);
  s.setAvailability(true);
  s.countdown = null;
  for (let i = 0; i < 8; i++) s.update(0.25, 2.2);
  assert.equal(s.phase, "over");
  assert.equal(s.flight.alive, false);
  assert.equal(s.flight.score, score);
});
test("best storage tolerates corruption, denial and unavailable APIs", () => {
  for (const value of [
    null,
    "",
    "NaN",
    "-1",
    "1.2",
    '{"score":99}',
    "Infinity",
    "99999999999999999999",
  ])
    assert.equal(readBest({ getItem: () => value }), 0);
  assert.equal(readBest({ getItem: () => "42" }), 42);
  assert.equal(
    readBest({
      getItem: () => {
        throw new Error("denied");
      },
    }),
    0,
  );
  assert.equal(
    saveBest(
      {
        setItem: () => {
          throw new Error("denied");
        },
      },
      3,
    ),
    false,
  );
});
