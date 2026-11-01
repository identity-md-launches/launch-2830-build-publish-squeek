import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BrandMark, Icon, Wheel } from "./Icons";
import { HardwareSignal, isFresh, type SignalState } from "./live/signal";
import { Session, readBest, saveBest, type Phase } from "./game/engine";
import { WORLD, windFor } from "./game/config";
import { drawCraft, drawScenery, renderGame } from "./game/art";

const initialSignal: SignalState = {
  kind: "connecting",
  reading: null,
  message: "Connecting to the wheel...",
};
type View = {
  phase: Phase;
  paused: boolean;
  reason: string | null;
  countdown: number | null;
  score: number;
  doubleRemaining: number;
  wind: number;
};
function viewOf(s: Session): View {
  return {
    phase: s.phase,
    paused: s.interrupted,
    reason: s.pauseReason,
    countdown: s.countdown === null ? null : Math.ceil(s.countdown),
    score: s.flight.score,
    doubleRemaining: Math.ceil(s.flight.doubleRemaining * 10) / 10,
    wind: Math.round(s.flight.wind * 100) / 100,
  };
}
const rpmFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const windFormat = new Intl.NumberFormat("en", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
function bestFromBrowser() {
  try {
    return readBest(window.localStorage);
  } catch {
    return 0;
  }
}

export default function App() {
  const [session] = useState(() => new Session());
  const hardware = useRef<HardwareSignal | null>(null);
  const signalRef = useRef(initialSignal);
  const [signal, setSignal] = useState(initialSignal);
  const [view, setView] = useState<View>(() => viewOf(session));
  const [best, setBest] = useState(bestFromBrowser);
  const bestRef = useRef(best);
  const [storageOK, setStorageOK] = useState(true);
  const bestScope = storageOK
    ? "saved on this device"
    : "kept for this session only";
  const bestPlace = storageOK ? "this device" : "this session only";
  const [help, setHelp] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scenery = useRef<HTMLCanvasElement>(null);
  const mascot = useRef<HTMLCanvasElement>(null);
  const wheel = useRef<SVGGElement>(null);
  const game = useRef<HTMLDivElement>(null);
  const retry = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const helpTrigger = useRef<HTMLButtonElement>(null);
  const frameReset = useRef(true);
  const ready = isFresh(signal);
  const signalMessage =
    signal.kind === "ready" && !ready
      ? "Stale wheel data. Reconnecting..."
      : signal.message;
  const inRun = view.phase === "playing" || view.phase === "crashed";
  const running =
    view.phase === "playing" && !view.paused && view.countdown === null;

  useEffect(() => {
    const poller = new HardwareSignal((state) => {
      signalRef.current = state;
      setSignal(state);
      session.setAvailability(isFresh(state), document.hidden);
      frameReset.current = true;
    });
    hardware.current = poller;
    poller.start();
    const visibility = () => {
      frameReset.current = true;
      session.setAvailability(false, document.hidden);
      poller.setHidden(document.hidden);
    };
    document.addEventListener("visibilitychange", visibility);
    if (document.hidden) visibility();
    const orientation = window.matchMedia("(orientation: landscape)");
    const rotate = () => {
      session.pause("orientation");
      poller.requireFresh();
      frameReset.current = true;
    };
    orientation.addEventListener("change", rotate);
    return () => {
      poller.stop();
      document.removeEventListener("visibilitychange", visibility);
      orientation.removeEventListener("change", rotate);
    };
  }, []);

  useEffect(() => {
    let raf = 0,
      last = 0,
      previousView = "",
      wheelAngle = 0;
    const render = (now: number) => {
      // Read at animation time so preference changes apply before drawing.
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const s = session;
      const current = signalRef.current;
      const fresh = isFresh(current);
      if (!fresh && s.ready) s.setAvailability(false, document.hidden);
      let dt = last ? (now - last) / 1000 : 0;
      last = now;
      if (frameReset.current) {
        dt = 0;
        frameReset.current = false;
        s.flight.discardTime();
      }
      const target = current.reading
        ? windFor(current.reading.rpm, current.reading.coreStatus === "IDLE")
        : 1;
      s.update(dt, target, reduceMotion);
      if (s.phase === "crashed" && !s.crashNotified) {
        s.crashNotified = true;
        if (s.flight.score > bestRef.current) {
          bestRef.current = s.flight.score;
          setBest(s.flight.score);
          try {
            setStorageOK(saveBest(window.localStorage, s.flight.score));
          } catch {
            setStorageOK(false);
          }
        }
      }
      const v = viewOf(s),
        serialized = JSON.stringify(v);
      if (serialized !== previousView) {
        setView(v);
        previousView = serialized;
      }
      if (canvas.current) {
        const c = canvas.current.getContext("2d");
        if (c) renderGame(c, s, reduceMotion);
      }
      if (
        wheel.current &&
        fresh &&
        current.reading?.coreStatus === "ACTIVE" &&
        !document.hidden &&
        !reduceMotion
      ) {
        wheelAngle = (wheelAngle + (current.reading?.rpm ?? 0) * 6 * dt) % 360;
        wheel.current.setAttribute("transform", `rotate(${wheelAngle} 22 21)`);
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const surface = scenery.current;
    if (!surface) return;
    const render = () => {
      const rect = surface.getBoundingClientRect(),
        dpr = Math.min(devicePixelRatio || 1, 2);
      surface.width = rect.width * dpr;
      surface.height = rect.height * dpr;
      const c = surface.getContext("2d");
      if (c) {
        c.scale(dpr, dpr);
        drawScenery(c, rect.width, rect.height);
      }
      const portrait = mascot.current;
      if (portrait) {
        const ctx = portrait.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, 600, 440);
          drawCraft(ctx, 310, 222, 3.05, 0.035, 1.7);
        }
      }
    };
    const observer = new ResizeObserver(render);
    observer.observe(surface);
    render();
    return () => observer.disconnect();
  }, [view.phase]);

  useEffect(() => {
    if (view.phase === "over") retry.current?.focus({ preventScroll: true });
  }, [view.phase]);
  useLayoutEffect(() => {
    if (view.phase !== "playing" || view.countdown !== 3) return;
    // The welcome screen can be taller than the flight screen. Position the
    // mounted world before its first countdown frame, including on retry.
    game.current?.parentElement?.scrollIntoView({
      behavior: "instant",
      block: "nearest",
    });
    game.current?.focus({ preventScroll: true });
    frameReset.current = true;
  }, [view.phase, view.countdown]);
  useEffect(() => {
    if (help) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [help]);
  function openHelp() {
    if (session.pauseReason === null) session.pause("help");
    setHelp(true);
  }
  function closeHelp() {
    setHelp(false);
    if (session.pauseReason === "help") session.resume();
    frameReset.current = true;
    helpTrigger.current?.focus();
  }
  function start() {
    session.setAvailability(isFresh(signalRef.current), document.hidden);
    if (session.start()) {
      frameReset.current = true;
      setView(viewOf(session));
    }
  }
  function resume() {
    session.resume();
    frameReset.current = true;
    game.current?.focus({ preventScroll: true });
  }
  function flap() {
    // Check expiry at the actual input, in addition to poll and animation checks.
    if (!isFresh(signalRef.current))
      session.setAvailability(false, document.hidden);
    session.flap();
  }
  const connectionLabel = ready
    ? "Connected"
    : signal.kind === "connecting"
      ? "Connecting"
      : "Waiting for signal";
  const pausedTitle =
    view.reason === "orientation"
      ? "Screen rotated"
      : view.reason === "manual"
        ? "Paused"
        : !ready
          ? "Waiting for the wheel"
          : "Pause";
  return (
    <>
      <header className="header">
        <div className="brand">
          <BrandMark />
          <span>
            Squeek <span className="brand-amp">&</span> Glide
          </span>
        </div>
        <div className="header-actions">
          <span className="lane">Squeekchain · Genesis Code Lane</span>
          <button
            className="utility"
            type="button"
            onClick={openHelp}
            ref={helpTrigger}
          >
            <Icon name="help" />
            <span>How to play</span>
          </button>
        </div>
      </header>
      <main>
        <section
          className={`stage ${view.phase === "start" ? "is-start" : "is-game"}`}
          aria-label="Squeek & Glide"
        >
          <canvas className="landscape" ref={scenery} aria-hidden="true" />
          <div className="stage-top">
            {view.phase === "start" && (
              <div
                className="best"
                title={`Best score ${bestScope}`}
                aria-label={`Best score ${best}, ${bestScope}`}
              >
                <Icon name="medal" />
                <span>
                  Best score <strong>{best}</strong>{" "}
                  <span className="device-label">· {bestPlace}</span>
                </span>
              </div>
            )}
            <span className={`connection ${ready ? "connected" : ""}`}>
              <span className="status-dot" />
              {connectionLabel}
            </span>
          </div>
          {view.phase === "start" ? (
            <div className="welcome">
              <div className="welcome-copy">
                <h1>
                  Squeek <span>&amp; Glide</span>
                </h1>
                <p className="intro">
                  You pilot. A real hamster powers the wind.
                </p>
                <div className="start-action">
                  <button
                    className="primary"
                    type="button"
                    onClick={start}
                    disabled={!ready}
                  >
                    <Icon name="play" />
                    <span>Start flying</span>
                    <Icon name="arrow" />
                  </button>
                  <p className="control-hint">
                    Tap or press <kbd>Space</kbd> to flap
                  </p>
                </div>
              </div>
              <div className="portrait">
                <svg
                  className="flight-doodle"
                  viewBox="0 0 520 380"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M20 295c22-20 71-6 66 23-5 32-51 10-33-19 27-43 83-6 108-39"
                    stroke="#8bab91"
                    strokeWidth="2"
                    strokeDasharray="5 7"
                    strokeLinecap="round"
                  />
                  <path
                    d="m400 62 8-12m13 25 16-4m-25 19 11 6"
                    stroke="#a58d53"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <canvas
                  ref={mascot}
                  width="600"
                  height="440"
                  role="img"
                  aria-label="An orange-cheeked hamster pilots a cardboard box with seed-shell wings and wooden braces"
                />
              </div>
            </div>
          ) : (
            <>
              <div
                className={`game-layout ${view.phase === "over" || view.paused ? "has-panel" : ""}`}
              >
                <aside className="flight-notes" aria-hidden="true">
                  <span className="note-line" />
                  <p>
                    A little box.
                    <br />A whole sky.
                  </p>
                  <svg width="98" height="80" viewBox="0 0 98 80" fill="none">
                    <path
                      d="M10 8C8 61 60 65 78 36m-18 3 20-7-2 20"
                      stroke="#91ae96"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray="5 6"
                    />
                  </svg>
                </aside>
                <div
                  className={`game-viewport ${running ? "is-active" : ""}`}
                  ref={game}
                  tabIndex={0}
                  role="group"
                  aria-label="Flight area. Press Space to flap, Escape to pause."
                  aria-describedby="flight-controls"
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.code === "Space" && session.active) {
                      e.preventDefault();
                      if (!e.repeat) flap();
                    }
                    if (e.code === "Escape" && inRun) {
                      e.preventDefault();
                      session.pause("manual");
                    }
                  }}
                  onPointerDown={(e) => {
                    if (
                      !(e.target instanceof HTMLCanvasElement) ||
                      !e.isPrimary ||
                      e.button !== 0 ||
                      !session.active
                    )
                      return;
                    e.preventDefault();
                    game.current?.focus({ preventScroll: true });
                    flap();
                  }}
                >
                  <canvas
                    ref={canvas}
                    width={WORLD.width}
                    height={WORLD.height}
                    aria-hidden="true"
                  />
                </div>
                {view.phase !== "over" && (
                  <div className="game-hud">
                    <div className="score-stack">
                      <div className="score-cluster">
                        <output
                          className="score"
                          aria-label="Score"
                          aria-live="off"
                        >
                          {view.score}
                        </output>
                        {view.doubleRemaining > 0 && (
                          <span
                            className="double-badge"
                            aria-label={`Double points: ${view.doubleRemaining.toFixed(1)} seconds remaining`}
                          >
                            <svg viewBox="0 0 36 36" aria-hidden="true">
                              <circle
                                className="timer-track"
                                cx="18"
                                cy="18"
                                r="15"
                              />
                              <circle
                                className="timer-ring"
                                cx="18"
                                cy="18"
                                r="15"
                                pathLength="100"
                                strokeDasharray={`${(view.doubleRemaining / 8) * 100} 100`}
                                transform="rotate(-90 18 18)"
                              />
                            </svg>
                            <strong>x2</strong>
                            <span>{view.doubleRemaining.toFixed(1)}s</span>
                          </span>
                        )}
                      </div>
                      <span
                        className="run-best"
                        title={`Best score ${bestScope}`}
                        aria-label={`Best score ${best}, ${bestScope}`}
                      >
                        Best score {best}{" "}
                        <span className="device-label">· {bestPlace}</span>
                      </span>
                    </div>
                    {inRun && !view.paused && view.countdown === null && (
                      <button
                        className="pause-button"
                        aria-label="Pause"
                        type="button"
                        onClick={() => {
                          session.pause("manual");
                          setView(viewOf(session));
                        }}
                      >
                        <Icon name="pause" />
                      </button>
                    )}
                  </div>
                )}
                {inRun && view.paused && (
                  <div className="game-overlay">
                    <div className="pause-card">
                      <Icon name={!ready ? "signal" : "pause"} />
                      <h2>{pausedTitle}</h2>
                      <p>
                        {!ready
                          ? "Your flight is frozen. Waiting for fresh hardware data."
                          : view.reason === "orientation"
                            ? "Your flight is paused. Resume when you are ready."
                            : "Your flight is ready when you are."}
                      </p>
                      {ready && (
                        <button
                          className="primary"
                          type="button"
                          onClick={resume}
                        >
                          Resume <Icon name="play" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {inRun && !view.paused && view.countdown !== null && (
                  <div className="game-overlay countdown-overlay">
                    <div className="countdown" aria-hidden="true">
                      {view.countdown}
                    </div>
                    <p>Get ready to flap</p>
                  </div>
                )}
                {view.phase === "over" && (
                  <div
                    className="game-overlay over-overlay"
                    tabIndex={0}
                    role="region"
                    aria-label="Flight results"
                  >
                    <div className="result">
                      <span className="result-icon">
                        <Icon name="medal" />
                      </span>
                      <h2>Touchdown!</h2>
                      <p>Pack the parachute. Try another flight.</p>
                      <div className="result-numbers">
                        <div>
                          <span>Score</span>
                          <strong>{view.score}</strong>
                        </div>
                        <div>
                          <span>
                            Best score
                            <br />
                            <span className="device-label">
                              {storageOK
                                ? "on this device"
                                : "this session only"}
                            </span>
                          </span>
                          <strong>{best}</strong>
                        </div>
                      </div>
                      <button
                        className="primary"
                        type="button"
                        onClick={start}
                        disabled={!ready}
                        ref={retry}
                      >
                        Fly again <Icon name="arrow" />
                      </button>
                      <p
                        className={`local-note${storageOK ? "" : " is-warning"}`}
                      >
                        {storageOK
                          ? "Best score saved on this device."
                          : "Storage unavailable. Best score kept for this session only."}
                      </p>
                    </div>
                  </div>
                )}
                <aside className="flight-notes right-note" aria-hidden="true">
                  <Icon name="seed" />
                  <p>
                    Catch a seed,
                    <br />
                    earn a point.
                  </p>
                </aside>
              </div>
              <h1 className="sr-only">Squeek &amp; Glide</h1>
            </>
          )}
          <div className="live-strip">
            <div className={`live-source ${ready ? "has-reading" : ""}`}>
              <Wheel
                wheelRef={wheel}
                state={
                  !ready
                    ? "unknown"
                    : signal.reading?.coreStatus === "IDLE"
                      ? "resting"
                      : "running"
                }
                moving={
                  ready &&
                  signal.reading?.coreStatus === "ACTIVE" &&
                  signal.reading.rpm > 0
                }
              />
              <div>
                <span className="source-title">
                  {ready
                    ? signal.reading?.coreStatus === "IDLE"
                      ? "Resting"
                      : "Running"
                    : "Real hamster wind"}
                </span>
                <span className="source-state" role="status" aria-live="polite">
                  {signalMessage === "Running"
                    ? "Wheel connected"
                    : signalMessage}
                </span>
              </div>
            </div>
            <div className="telemetry">
              <div>
                <strong>
                  {ready && signal.reading
                    ? rpmFormat.format(signal.reading.rpm)
                    : "—"}
                </strong>
                <span>RPM</span>
              </div>
              <span className="metric-divider" />
              <div className="wind-value">
                <Icon name="wind" />
                <strong>
                  {ready
                    ? windFormat.format(
                        view.phase === "start"
                          ? windFor(
                              signal.reading!.rpm,
                              signal.reading!.coreStatus === "IDLE",
                            )
                          : view.wind,
                      )
                    : "—"}
                  {ready ? "×" : ""}
                </strong>
                <span>wind</span>
              </div>
            </div>
          </div>
        </section>
        <div className="under-stage" id="flight-controls">
          {view.phase !== "start" && (
            <span className="control-legend">
              <kbd>Space</kbd>
              <span>or tap to flap</span>
            </span>
          )}
          <span>
            <span className="gate-symbol" aria-hidden="true" />
            Pass a pair <strong>+1</strong>
          </span>
          <span>
            <Icon name="seed" />
            Collect a seed <strong>+1</strong>
          </span>
        </div>
      </main>
      <footer className="footer">
        <span>A flight with Squeekchain</span>
        <a
          href="https://docs.squeekchain.com/developers/api/"
          target="_blank"
          rel="noreferrer"
        >
          Data source <span aria-hidden="true">↗</span>
        </a>
      </footer>
      <p className="sr-only" role="status" aria-live="polite">
        {view.phase === "over"
          ? `Flight over. Score ${view.score}. Best score ${best}, ${bestScope}.`
          : inRun && view.paused
            ? "Flight paused."
            : view.countdown !== null
              ? `Flight begins in ${view.countdown}.`
              : ""}
      </p>
      <p className="sr-only" role="status">
        {view.doubleRemaining > 0
          ? "Double points active. New points count twice for eight seconds of flying."
          : ""}
      </p>
      <dialog
        ref={dialog}
        className="help-dialog"
        aria-labelledby="help-title"
        onCancel={(e) => {
          e.preventDefault();
          closeHelp();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeHelp();
        }}
      >
        <div className="help-content">
          <button
            type="button"
            className="dialog-close utility"
            onClick={closeHelp}
            aria-label="Close instructions"
          >
            <Icon name="close" />
          </button>
          <h2 id="help-title">How to play</h2>
          <ol>
            <li>
              <strong>Tap or press Space to flap.</strong> Tap or click the
              flight area. Each press flaps once; release to fall.
            </li>
            <li>
              <strong>Dodge the cardboard.</strong> Pass a pair for +1. Collect
              a sunflower seed for +1. Touching a wall or the sky’s edge ends
              your flight.
            </li>
            <li>
              <strong>Catch a Golden Seed.</strong> The glowing x2 seed doubles
              new points for 8 seconds of flying. Another refreshes the timer.
              Pauses freeze it.
            </li>
            <li>
              <strong>Ride the real wind.</strong> Faster wheel, stronger wind.
              Hamster resting? Keep flying at minimum speed. Signal lost? Your
              flight pauses until fresh hardware data returns.
            </li>
          </ol>
          <p>
            The first 10 gaps are wide; new gaps narrow until pair 30. Golden
            Seeds first appear in pairs 11–18, then every 6–8 pairs. Press
            Escape or Pause to take a break.
          </p>
          <button type="button" className="primary" onClick={closeHelp}>
            Close instructions <Icon name="check" />
          </button>
        </div>
      </dialog>
    </>
  );
}
