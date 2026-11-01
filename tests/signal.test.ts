import test from "node:test";
import assert from "node:assert/strict";
import {
  HardwareSignal,
  validateStatus,
  isFresh,
  retryDelay,
  type SignalState,
} from "../src/live/signal";
const NOW = Date.parse("2026-11-01T14:00:00Z");
// Synthetic responses are test-only, never imported by or shipped as a playable source.
const status = (m: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  measurement: {
    freshness: "online",
    provenance: "hardware",
    coreStatus: "ACTIVE",
    rpmMilli: 60000,
    receivedAt: new Date(NOW).toISOString(),
    staleAfterSeconds: 120,
    ...m,
  },
});
test("valid hardware ACTIVE and IDLE only, thousandths conversion and exact expiration", () => {
  const result = validateStatus(status(), NOW);
  assert.equal(result.kind, "ready");
  assert.equal(result.reading?.rpm, 60);
  assert.equal(isFresh(result, NOW + 119999), true);
  assert.equal(isFresh(result, NOW + 120000), false);
  assert.equal(
    validateStatus(status({ coreStatus: "IDLE", rpmMilli: 0 }), NOW).message,
    "Hamster đang nghỉ",
  );
});
test("unknown schemas, null, arrays, malformed measurements and all untrusted sources are rejected", () => {
  for (const data of [
    null,
    [],
    {},
    "oops",
    { ...status(), schemaVersion: 2 },
    { ...status(), schemaVersion: "1" },
    { ...status(), measurement: null },
  ])
    assert.notEqual(validateStatus(data, NOW).kind, "ready");
  for (const provenance of ["simulated", "replay", "derived", null, undefined])
    assert.notEqual(validateStatus(status({ provenance }), NOW).kind, "ready");
  for (const coreStatus of ["COUNTER_FAULT", "OFFLINE", null, undefined])
    assert.notEqual(validateStatus(status({ coreStatus }), NOW).kind, "ready");
  for (const rpmMilli of [-1, NaN, Infinity, "0", null, undefined, 0.2])
    assert.notEqual(validateStatus(status({ rpmMilli }), NOW).kind, "ready");
  for (const receivedAt of [
    "",
    "2026",
    "2026-11-01",
    "not a date",
    new Date(NOW + 6000).toISOString(),
  ])
    assert.notEqual(validateStatus(status({ receivedAt }), NOW).kind, "ready");
  for (const staleAfterSeconds of [0, -1, NaN, Infinity, null, "120"])
    assert.notEqual(
      validateStatus(status({ staleAfterSeconds }), NOW).kind,
      "ready",
    );
  assert.equal(
    validateStatus(status({ freshness: "stale" }), NOW).kind,
    "stale",
  );
  assert.equal(validateStatus(status(), NOW + 120001).kind, "stale");
});
test("Retry-After supports seconds and HTTP dates without shortening the wait", () => {
  assert.equal(retryDelay("12", NOW), 12000);
  assert.equal(retryDelay(new Date(NOW + 60000).toUTCString(), NOW), 60000);
  assert.equal(retryDelay("nonsense", NOW), 0);
  assert.equal(retryDelay(null, NOW), 0);
});
class Clock {
  now = NOW;
  id = 0;
  tasks = new Map<number, { at: number; fn: () => void }>();
  set = (fn: () => void, ms: number) => {
    const id = ++this.id;
    this.tasks.set(id, { at: this.now + ms, fn });
    return id as unknown as ReturnType<typeof setTimeout>;
  };
  clear = (id: ReturnType<typeof setTimeout>) => {
    this.tasks.delete(id as unknown as number);
  };
  async advance(ms: number) {
    const end = this.now + ms;
    for (;;) {
      const first = [...this.tasks.entries()].sort(
        (a, b) => a[1].at - b[1].at,
      )[0];
      if (!first || first[1].at > end) break;
      this.now = first[1].at;
      this.tasks.delete(first[0]);
      first[1].fn();
      for (let i = 0; i < 8; i++) await Promise.resolve();
    }
    this.now = end;
    for (let i = 0; i < 8; i++) await Promise.resolve();
  }
}
function setup(fetcher: typeof fetch) {
  const clock = new Clock();
  let current: SignalState | undefined;
  const signal = new HardwareSignal(
    (s) => {
      current = s;
    },
    {
      fetcher,
      now: () => clock.now,
      setTimer: clock.set,
      clearTimer: clock.clear,
    },
  );
  return {
    clock,
    signal,
    get current() {
      return current;
    },
  };
}
test("polls on five second cadence and locally ages cached measurements between polls", async () => {
  let calls = 0;
  const s = setup(async () => {
    calls++;
    return Response.json(status({ staleAfterSeconds: 2 }));
  });
  s.signal.start();
  await s.clock.advance(0);
  assert.equal(calls, 1);
  assert.equal(s.current?.kind, "ready");
  await s.clock.advance(2100);
  assert.equal(s.current?.kind, "stale");
  assert.equal(calls, 1);
  await s.clock.advance(2900);
  assert.equal(calls, 2);
  assert.equal(s.current?.kind, "stale");
  s.signal.stop();
});
test("429 and 503 respect Retry-After and then recover; failures have exponential backoff", async () => {
  let calls = 0;
  const s = setup(async () => {
    calls++;
    if (calls === 1)
      return new Response("", {
        status: 429,
        headers: { "Retry-After": "20" },
      });
    if (calls === 2)
      return new Response("", {
        status: 503,
        headers: { "Retry-After": "30" },
      });
    return Response.json(status());
  });
  s.signal.start();
  await s.clock.advance(0);
  assert.equal(s.current?.kind, "error");
  await s.clock.advance(19999);
  assert.equal(calls, 1);
  await s.clock.advance(1);
  assert.equal(calls, 2);
  await s.clock.advance(29999);
  assert.equal(calls, 2);
  await s.clock.advance(1);
  assert.equal(calls, 3);
  assert.equal(s.current?.kind, "ready");
  s.signal.stop();
  let failures = 0;
  const e = setup(async () => {
    failures++;
    throw new Error("offline");
  });
  e.signal.start();
  await e.clock.advance(0);
  assert.equal(failures, 1);
  await e.clock.advance(5000);
  assert.equal(failures, 2);
  await e.clock.advance(9999);
  assert.equal(failures, 2);
  await e.clock.advance(1);
  assert.equal(failures, 3);
  e.signal.stop();
});
test("timeout aborts, one request at a time, hide invalidates outstanding readings and resume fetches again", async () => {
  let concurrent = 0,
    maxConcurrent = 0,
    calls = 0;
  const s = setup(async (_input, init) => {
    concurrent++;
    calls++;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    return await new Promise<Response>((resolve, reject) => {
      if (calls > 2) {
        concurrent--;
        resolve(Response.json(status()));
        return;
      }
      init?.signal?.addEventListener(
        "abort",
        () => {
          concurrent--;
          reject(new Error("abort"));
        },
        { once: true },
      );
    });
  });
  s.signal.start();
  await s.clock.advance(0);
  assert.equal(calls, 1);
  await s.clock.advance(3999);
  assert.equal(calls, 1);
  await s.clock.advance(1);
  assert.equal(s.current?.kind, "error");
  assert.equal(concurrent, 0);
  await s.clock.advance(5000);
  assert.equal(calls, 2);
  s.signal.setHidden(true);
  await s.clock.advance(0);
  assert.equal(s.current?.kind, "hidden");
  await s.clock.advance(60000);
  assert.equal(calls, 2);
  s.signal.setHidden(false);
  await s.clock.advance(0);
  assert.equal(calls, 3);
  assert.equal(maxConcurrent, 1);
  assert.equal(s.current?.kind, "ready");
  s.signal.stop();
});
test("bad JSON pauses immediately; a response from before visibility change cannot enable play", async () => {
  const s = setup(async () => new Response("not JSON", { status: 200 }));
  s.signal.start();
  await s.clock.advance(0);
  assert.equal(s.current?.kind, "error");
  s.signal.stop();
  let resolve!: (response: Response) => void;
  const stale = setup(
    async () =>
      new Promise<Response>((r) => {
        resolve = r;
      }),
  );
  stale.signal.start();
  await stale.clock.advance(0);
  stale.signal.setHidden(true);
  resolve(Response.json(status()));
  await stale.clock.advance(0);
  assert.equal(stale.current?.kind, "hidden");
  stale.signal.stop();
});

test("impossible calendar dates are rejected instead of normalized", () => {
  const bad = status({
    receivedAt: "2026-02-30T14:00:00Z",
    staleAfterSeconds: 31536000,
  });
  assert.equal(
    validateStatus(bad, Date.parse("2026-03-02T14:00:01Z")).kind,
    "invalid",
  );
});
