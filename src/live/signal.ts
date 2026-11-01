/** Public hardware only. Invalid/expired input must never become an IDLE reading. */
export const STATUS_URL = "https://api.squeekchain.com/v1/status";
export const POLL_MS = 5_000;
export const TIMEOUT_MS = 4_000;
export interface Reading {
  rpm: number;
  coreStatus: "ACTIVE" | "IDLE";
  receivedAt: number;
  expiresAt: number;
}
export type SignalKind =
  "connecting" | "ready" | "stale" | "invalid" | "error" | "hidden";
export interface SignalState {
  kind: SignalKind;
  reading: Reading | null;
  message: string;
}
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
export function validateStatus(data: unknown, now = Date.now()): SignalState {
  const invalid = (message: string): SignalState => ({
    kind: "invalid",
    reading: null,
    message,
  });
  if (!record(data) || data.schemaVersion !== 1)
    return invalid("Unsupported wheel data. Waiting for a valid reading.");
  const m = data.measurement;
  if (!record(m)) return invalid("Wheel data missing. Reconnecting...");
  if (m.provenance !== "hardware")
    return invalid("Waiting for real hardware data...");
  if (m.coreStatus === "COUNTER_FAULT")
    return invalid("Wheel sensor fault. Waiting for recovery.");
  if (m.coreStatus !== "ACTIVE" && m.coreStatus !== "IDLE")
    return invalid("Unknown wheel status. Reconnecting...");
  if (
    typeof m.rpmMilli !== "number" ||
    !Number.isSafeInteger(m.rpmMilli) ||
    m.rpmMilli < 0
  )
    return invalid("Invalid RPM reading. Reconnecting...");
  if (
    typeof m.receivedAt !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(
      m.receivedAt,
    )
  )
    return invalid("Missing measurement time. Reconnecting...");
  const [year, month, day] = m.receivedAt.slice(0, 10).split("-").map(Number);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate()
  )
    return invalid("Invalid measurement date. Reconnecting...");
  const receivedAt = Date.parse(m.receivedAt);
  if (
    !Number.isFinite(receivedAt) ||
    receivedAt > now + 5_000 ||
    typeof m.staleAfterSeconds !== "number" ||
    !Number.isFinite(m.staleAfterSeconds) ||
    m.staleAfterSeconds <= 0
  )
    return invalid("Invalid data expiry. Reconnecting...");
  const expiresAt = receivedAt + m.staleAfterSeconds * 1_000;
  if (!Number.isFinite(expiresAt))
    return invalid("Invalid data expiry. Reconnecting...");
  if (m.freshness !== "online" || now >= expiresAt)
    return {
      kind: "stale",
      reading: null,
      message: "Stale wheel data. Reconnecting...",
    };
  return {
    kind: "ready",
    reading: {
      rpm: m.rpmMilli / 1_000,
      coreStatus: m.coreStatus,
      receivedAt,
      expiresAt,
    },
    message: m.coreStatus === "IDLE" ? "Hamster resting" : "Running",
  };
}
export function isFresh(state: SignalState, now = Date.now()): boolean {
  return (
    state.kind === "ready" &&
    state.reading !== null &&
    now < state.reading.expiresAt
  );
}
export function retryDelay(value: string | null, now: number): number {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.max(0, time - now) : 0;
}
interface PollOptions {
  fetcher?: typeof fetch;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (id: ReturnType<typeof setTimeout>) => void;
}
export class HardwareSignal {
  state: SignalState = {
    kind: "connecting",
    reading: null,
    message: "Connecting to the wheel...",
  };
  private fetcher: typeof fetch;
  private now: () => number;
  private timer: PollOptions["setTimer"] & {};
  private clear: PollOptions["clearTimer"] & {};
  private pollTimer?: ReturnType<typeof setTimeout>;
  private timeout?: ReturnType<typeof setTimeout>;
  private ageTimer?: ReturnType<typeof setTimeout>;
  private controller?: AbortController;
  private inFlight = false;
  private stopped = true;
  private hidden = false;
  private epoch = 0;
  private failures = 0;
  private notBefore = 0;
  private listener: (state: SignalState) => void;
  constructor(
    listener: (state: SignalState) => void,
    options: PollOptions = {},
  ) {
    this.listener = listener;
    this.fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
    this.now = options.now ?? Date.now;
    this.timer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clear = options.clearTimer ?? ((id) => clearTimeout(id));
  }
  private publish(state: SignalState) {
    this.state = state;
    this.listener(state);
  }
  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.schedule(0);
    this.age();
  }
  private age = () => {
    if (this.stopped) return;
    if (this.state.kind === "ready" && !isFresh(this.state, this.now())) {
      this.publish({
        kind: "stale",
        reading: null,
        message: "Stale wheel data. Reconnecting...",
      });
    }
    this.ageTimer = this.timer(this.age, 200);
  };
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    this.requireFresh();
  }
  /** Also used after an orientation change. Invalidates any request from before the interruption. */
  requireFresh() {
    this.epoch++;
    this.controller?.abort();
    if (this.pollTimer) this.clear(this.pollTimer);
    this.publish({
      kind: this.hidden ? "hidden" : "connecting",
      reading: null,
      message: this.hidden
        ? "Paused while this tab is hidden."
        : "Reconnecting...",
    });
    if (!this.hidden && !this.inFlight) this.schedule(0);
  }
  private schedule(ms: number) {
    if (this.stopped || this.hidden) return;
    if (this.pollTimer) this.clear(this.pollTimer);
    const delay = Math.max(ms, this.notBefore - this.now(), 0);
    // Chunk enormous Retry-After values instead of overflowing the platform's timer.
    this.pollTimer = this.timer(
      () => {
        if (this.now() < this.notBefore) this.schedule(0);
        else void this.poll();
      },
      Math.min(delay, 2_000_000_000),
    );
  }
  private async poll() {
    if (this.stopped || this.hidden || this.inFlight) return;
    this.inFlight = true;
    const epoch = this.epoch;
    const started = this.now();
    let delay = POLL_MS;
    this.controller = new AbortController();
    this.timeout = this.timer(() => this.controller?.abort(), TIMEOUT_MS);
    try {
      const response = await this.fetcher(STATUS_URL, {
        signal: this.controller.signal,
        cache: "no-store",
        credentials: "omit",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        if (response.status === 429 || response.status === 503)
          this.notBefore =
            this.now() +
            retryDelay(response.headers.get("Retry-After"), this.now());
        throw new Error(`HTTP ${response.status}`);
      }
      const data: unknown = await response.json();
      if (this.stopped || epoch !== this.epoch) return;
      const state = validateStatus(data, this.now());
      this.publish(state);
      this.failures = 0;
      // Invalid successful responses are still polled; no fictional zero-RPM fallback.
      delay = Math.max(0, POLL_MS - (this.now() - started));
    } catch {
      if (this.stopped || epoch !== this.epoch) return;
      this.failures++;
      delay = Math.min(60_000, POLL_MS * 2 ** Math.min(this.failures - 1, 4));
      this.publish({
        kind: "error",
        reading: null,
        message: "Connection lost. Reconnecting...",
      });
    } finally {
      if (this.timeout) this.clear(this.timeout);
      this.inFlight = false;
      this.controller = undefined;
      this.schedule(epoch !== this.epoch ? 0 : delay);
    }
  }
  stop() {
    this.stopped = true;
    this.epoch++;
    this.controller?.abort();
    for (const id of [this.pollTimer, this.timeout, this.ageTimer])
      if (id) this.clear(id);
  }
}
