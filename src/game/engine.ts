import { WIND, WORLD, gapFor } from "./config";
export interface Gate {
  index: number;
  worldX: number;
  center: number;
  gap: number;
  passed: boolean;
  seed: boolean;
  golden: boolean;
  collected: boolean;
  seedY: number;
}
export class Flight {
  y: number = WORLD.startY;
  velocity = 0;
  distance = 0;
  score = 0;
  passed = 0;
  seeds = 0;
  wind: number = WIND.min;
  alive = true;
  time = 0;
  flapAge = 1;
  gates: Gate[] = [];
  private accumulator = 0;
  private nextIndex = 1;
  private previousCenter: number = WORLD.startY;
  private nextGolden: number;
  private doubleTicks = 0;
  private rng: () => number;
  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    this.nextGolden = 11 + this.randomInterval(0, 7);
    this.spawn();
  }
  get doubleRemaining() {
    return this.doubleTicks * WORLD.step;
  }
  private randomInterval(min: number, max: number) {
    return min + Math.min(max - min, Math.floor(this.rng() * (max - min + 1)));
  }
  flap() {
    if (!this.alive) return;
    this.velocity = WORLD.flapVelocity;
    this.flapAge = 0;
  }
  private spawn() {
    while (
      WORLD.firstGateX + (this.nextIndex - 1) * WORLD.spacing <
      this.distance + WORLD.width + WORLD.spacing
    ) {
      const index = this.nextIndex++;
      const center = Math.max(
        WORLD.minCenter,
        Math.min(
          WORLD.maxCenter,
          this.previousCenter + (this.rng() * 2 - 1) * WORLD.maxCenterDelta,
        ),
      );
      const gap = gapFor(index);
      const golden = index === this.nextGolden;
      if (golden) this.nextGolden += this.randomInterval(6, 8);
      this.gates.push({
        index,
        worldX: WORLD.firstGateX + (index - 1) * WORLD.spacing,
        center,
        gap,
        passed: false,
        seed: !golden && index % 3 !== 0,
        golden,
        collected: false,
        seedY:
          center +
          (this.rng() > 0.5 ? 1 : -1) *
            Math.min(golden ? 24 : 38, gap / 2 - WORLD.halfHeight - 35),
      });
      this.previousCenter = center;
    }
  }
  advance(dt: number, targetWind: number) {
    if (!this.alive) return;
    this.accumulator += Math.min(Math.max(dt, 0), WORLD.maxFrame);
    while (this.accumulator >= WORLD.step && this.alive) {
      this.substep(WORLD.step, targetWind);
      this.accumulator -= WORLD.step;
    }
  }
  discardTime() {
    this.accumulator = 0;
  }
  private substep(dt: number, targetWind: number) {
    if (this.doubleTicks > 0) this.doubleTicks--;
    this.time += dt;
    this.flapAge += dt;
    this.wind +=
      (Math.max(WIND.min, Math.min(WIND.max, targetWind)) - this.wind) *
      (1 - Math.exp(-dt / WIND.smoothingSeconds));
    this.velocity += WORLD.gravity * dt;
    this.y += this.velocity * dt;
    this.distance += WORLD.baseSpeed * this.wind * dt;
    this.spawn();
    // All death checks precede ALL scoring in this substep, including seeds.
    if (
      this.y - WORLD.halfHeight <= 0 ||
      this.y + WORLD.halfHeight >= WORLD.height
    ) {
      this.alive = false;
      this.doubleTicks = 0;
      return;
    }
    for (const gate of this.gates) {
      const x = gate.worldX - this.distance;
      if (
        x <= WORLD.playerX + WORLD.halfWidth &&
        x + WORLD.gateWidth >= WORLD.playerX - WORLD.halfWidth &&
        (this.y - WORLD.halfHeight <= gate.center - gate.gap / 2 ||
          this.y + WORLD.halfHeight >= gate.center + gate.gap / 2)
      ) {
        this.alive = false;
        this.doubleTicks = 0;
        return;
      }
    }
    // Consume all Golden Seeds before awarding ANY eligible points in this step.
    // Integer physics ticks give exactly eight active seconds, with no drift.
    for (const gate of this.gates) {
      const x = gate.worldX - this.distance;
      if (
        gate.golden &&
        !gate.collected &&
        Math.abs(x + WORLD.gateWidth / 2 - WORLD.playerX) <
          WORLD.halfWidth + 9 &&
        Math.abs(gate.seedY - this.y) < WORLD.halfHeight + 11
      ) {
        gate.collected = true;
        this.doubleTicks = Math.round(8 / WORLD.step);
      }
    }
    const points = this.doubleTicks > 0 ? 2 : 1;
    for (const gate of this.gates) {
      const x = gate.worldX - this.distance;
      if (
        !gate.passed &&
        x + WORLD.gateWidth < WORLD.playerX - WORLD.halfWidth
      ) {
        gate.passed = true;
        this.passed++;
        this.score += points;
      }
      if (
        gate.seed &&
        !gate.collected &&
        Math.abs(x + WORLD.gateWidth / 2 - WORLD.playerX) <
          WORLD.halfWidth + 9 &&
        Math.abs(gate.seedY - this.y) < WORLD.halfHeight + 11
      ) {
        gate.collected = true;
        this.seeds++;
        this.score += points;
      }
    }
    this.gates = this.gates.filter(
      (g) => g.worldX - this.distance > -WORLD.gateWidth - 100,
    );
  }
}
export type Phase = "start" | "playing" | "crashed" | "over";
export type PauseReason = "manual" | "orientation" | "help" | null;
export class Session {
  flight = new Flight();
  phase: Phase = "start";
  ready = false;
  hidden = false;
  pauseReason: PauseReason = null;
  countdown: number | null = null;
  crashTime = 0;
  crashY = 0;
  crashNotified = false;
  get interrupted() {
    return !this.ready || this.hidden || this.pauseReason !== null;
  }
  get active() {
    return (
      this.phase === "playing" && !this.interrupted && this.countdown === null
    );
  }
  setAvailability(ready: boolean, hidden = false) {
    const interruptedBefore = this.interrupted;
    this.ready = ready;
    this.hidden = hidden;
    if (this.interrupted) {
      this.countdown = null;
      this.flight.discardTime();
    } else if (
      interruptedBefore &&
      (this.phase === "playing" || this.phase === "crashed")
    )
      this.countdown = 3;
  }
  start() {
    if (!this.ready || this.hidden) return false;
    this.flight = new Flight();
    this.phase = "playing";
    this.pauseReason = null;
    this.countdown = 3;
    this.crashTime = 0;
    this.crashY = 0;
    this.crashNotified = false;
    return true;
  }
  pause(reason: PauseReason = "manual") {
    if (this.phase !== "playing" && this.phase !== "crashed") return;
    this.pauseReason = reason;
    this.countdown = null;
    this.flight.discardTime();
  }
  resume() {
    this.pauseReason = null;
    this.countdown = this.ready && !this.hidden ? 3 : null;
    this.flight.discardTime();
  }
  flap() {
    if (this.active) this.flight.flap();
  }
  update(dt: number, targetWind: number, reducedMotion = false) {
    if (this.interrupted || this.phase === "start" || this.phase === "over")
      return;
    if (this.countdown !== null) {
      this.countdown -= Math.max(0, dt);
      if (this.countdown <= 0) {
        this.countdown = null;
        this.flight.discardTime();
      }
      return;
    }
    if (this.phase === "playing") {
      this.flight.advance(dt, targetWind);
      if (!this.flight.alive) {
        this.phase = "crashed";
        this.crashY = this.flight.y;
      }
    } else if (this.phase === "crashed") {
      this.crashTime += Math.min(dt, WORLD.maxFrame);
      if (this.crashTime >= (reducedMotion ? 0.45 : 1.8)) this.phase = "over";
    }
  }
}
export const BEST_KEY = "squeek-glide.best.v1";
export function readBest(storage: Pick<Storage, "getItem">): number {
  try {
    const raw = storage.getItem(BEST_KEY);
    if (raw === null || !/^\d{1,10}$/.test(raw)) return 0;
    const n = Number(raw);
    return Number.isSafeInteger(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}
export function saveBest(
  storage: Pick<Storage, "setItem">,
  value: number,
): boolean {
  try {
    storage.setItem(BEST_KEY, String(value));
    return true;
  } catch {
    return false;
  }
}
