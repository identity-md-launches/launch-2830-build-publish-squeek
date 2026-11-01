/** Owner-editable tuning; no player speed control. Changing max wind requires rerunning reachability tests. */
export const WIND = {
  rpmMin: 0,
  rpmMax: 120,
  min: 1,
  max: 2.2,
  smoothingSeconds: 0.67,
} as const;
export const WORLD = {
  width: 480,
  height: 640,
  playerX: 130,
  startY: 320,
  gravity: 720,
  flapVelocity: -250,
  halfWidth: 18,
  halfHeight: 22,
  baseSpeed: 120,
  step: 1 / 120,
  maxFrame: 0.25,
  gateWidth: 64,
  spacing: 330,
  firstGateX: 640,
  wideGap: 250,
  finalGap: 184,
  minCenter: 220,
  maxCenter: 420,
  maxCenterDelta: 52,
} as const;
export function windFor(rpm: number, idle = false): number {
  if (idle) return WIND.min;
  const t = Math.max(
    0,
    Math.min(1, (rpm - WIND.rpmMin) / (WIND.rpmMax - WIND.rpmMin)),
  );
  return WIND.min + t * (WIND.max - WIND.min);
}
export function gapFor(index: number): number {
  return (
    WORLD.wideGap -
    (WORLD.wideGap - WORLD.finalGap) *
      Math.min(1, Math.max(0, (index - 10) / 20))
  );
}
