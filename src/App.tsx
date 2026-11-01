import { useEffect, useRef, useState } from "react";
import { BrandMark, Icon, Wheel } from "./Icons";
import { HardwareSignal, isFresh, type SignalState } from "./live/signal";
import { Session, readBest, saveBest, type Phase } from "./game/engine";
import { WORLD, windFor } from "./game/config";
import { drawCraft, drawScenery, renderGame } from "./game/art";

const initialSignal: SignalState = {
  kind: "connecting",
  reading: null,
  message: "Đang kết nối bánh xe…",
};
type View = {
  phase: Phase;
  paused: boolean;
  reason: string | null;
  countdown: number | null;
  score: number;
  passed: number;
  seeds: number;
  wind: number;
};
function viewOf(s: Session): View {
  return {
    phase: s.phase,
    paused: s.interrupted,
    reason: s.pauseReason,
    countdown: s.countdown === null ? null : Math.ceil(s.countdown),
    score: s.flight.score,
    passed: s.flight.passed,
    seeds: s.flight.seeds,
    wind: Math.round(s.flight.wind * 100) / 100,
  };
}
const rpmFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const windFormat = new Intl.NumberFormat("vi-VN", {
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
      if (wheel.current && fresh && !document.hidden && !reduceMotion) {
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
      requestAnimationFrame(() => game.current?.focus({ preventScroll: true }));
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
    ? "Đã kết nối"
    : signal.kind === "connecting"
      ? "Đang kết nối"
      : "Chờ tín hiệu";
  const pausedTitle =
    view.reason === "orientation"
      ? "Màn hình đã xoay"
      : view.reason === "manual"
        ? "Nghỉ một nhịp"
        : !ready
          ? "Đang chờ làn gió"
          : "Tạm dừng chuyến bay";
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
            <span>Cách chơi</span>
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
            <div className="best">
              <Icon name="medal" />
              <span>
                Kỷ lục <strong>{best}</strong>
              </span>
            </div>
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
                <p className="intro">Bạn cầm lái. Hamster thật tạo gió.</p>
                <div className="start-action">
                  <button
                    className="primary"
                    type="button"
                    onClick={start}
                    disabled={!ready}
                  >
                    <Icon name="play" />
                    <span>Bắt đầu bay</span>
                    <Icon name="arrow" />
                  </button>
                  <p className="control-hint">
                    Chạm hoặc nhấn <kbd>Space</kbd> để vỗ cánh
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
                  aria-label="Hamster má cam lái chiếc hộp giấy vàng, với cánh vỏ hạt dưa đen và thanh gỗ nhỏ"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="game-layout">
                <aside className="flight-notes" aria-hidden="true">
                  <span className="note-line" />
                  <p>
                    Một chiếc hộp nhỏ.
                    <br />
                    Cả bầu trời rộng.
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
                  aria-label="Vùng bay. Nhấn Space để vỗ cánh, Escape để tạm dừng."
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
                  <div className="game-hud" aria-hidden={view.phase === "over"}>
                    <output
                      className="score"
                      aria-label="Điểm chuyến bay"
                      aria-live="off"
                    >
                      {view.score}
                    </output>
                  </div>
                  {inRun && !view.paused && view.countdown === null && (
                    <button
                      className="pause-button"
                      aria-label="Tạm dừng chuyến bay"
                      type="button"
                      onClick={() => {
                        session.pause("manual");
                        setView(viewOf(session));
                      }}
                    >
                      <Icon name="pause" />
                    </button>
                  )}
                  {inRun && view.paused && (
                    <div className="game-overlay">
                      <div className="pause-card">
                        <Icon name={!ready ? "signal" : "pause"} />
                        <h2>{pausedTitle}</h2>
                        <p>
                          {!ready
                            ? "Chuyến bay được giữ nguyên. Tự tiếp tục khi có dữ liệu mới."
                            : view.reason === "orientation"
                              ? "Tỷ lệ thế giới vẫn giữ nguyên. Sẵn sàng bay tiếp?"
                              : "Chiếc hộp vẫn chờ bạn ở đây."}
                        </p>
                        {ready && (
                          <button
                            className="primary"
                            type="button"
                            onClick={resume}
                          >
                            Tiếp tục bay <Icon name="play" />
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
                      <p>Chuẩn bị vỗ cánh</p>
                    </div>
                  )}
                  {view.phase === "over" && (
                    <div className="game-overlay over-overlay">
                      <div className="result">
                        <span className="result-icon">
                          <Icon name="medal" />
                        </span>
                        <h2>Hạ cánh rồi!</h2>
                        <p>Gấp lại dù, bay thêm lần nữa?</p>
                        <div className="result-numbers">
                          <div>
                            <span>Điểm chuyến bay</span>
                            <strong>{view.score}</strong>
                          </div>
                          <div>
                            <span>Kỷ lục của bạn</span>
                            <strong>{best}</strong>
                          </div>
                        </div>
                        <p className="score-detail">
                          {view.passed} khe vượt qua · {view.seeds} hạt hướng
                          dương
                        </p>
                        <button
                          className="primary"
                          type="button"
                          onClick={start}
                          disabled={!ready}
                          ref={retry}
                        >
                          Bay lần nữa <Icon name="arrow" />
                        </button>
                        <p className="local-note">
                          {storageOK
                            ? "Kỷ lục được lưu trên trình duyệt này."
                            : "Trình duyệt không cho lưu. Kỷ lục chỉ giữ trong phiên này."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <aside className="flight-notes right-note" aria-hidden="true">
                  <Icon name="seed" />
                  <p>
                    Thêm một hạt,
                    <br />
                    thêm một điểm.
                  </p>
                </aside>
              </div>
              <h1 className="sr-only">Squeek &amp; Glide</h1>
            </>
          )}
          <div className="live-strip">
            <div className="live-source">
              <Wheel wheelRef={wheel} />
              <div>
                <span className="source-title">Gió từ hamster thật</span>
                <span className="source-state" role="status" aria-live="polite">
                  {signal.message}
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
                <span>gió</span>
              </div>
            </div>
          </div>
        </section>
        <div className="under-stage" id="flight-controls">
          {view.phase !== "start" && (
            <span className="control-legend">
              <kbd>Space</kbd>
              <span>hoặc chạm để bay</span>
            </span>
          )}
          <span>
            <span className="gate-symbol" aria-hidden="true" />
            Qua khe <strong>+1</strong>
          </span>
          <span>
            <Icon name="seed" />
            Nhặt hạt <strong>+1</strong>
          </span>
        </div>
      </main>
      <footer className="footer">
        <span>Một chuyến bay cùng Squeekchain</span>
        <a
          href="https://docs.squeekchain.com/developers/api/"
          target="_blank"
          rel="noreferrer"
        >
          Nguồn dữ liệu <span aria-hidden="true">↗</span>
        </a>
      </footer>
      <p className="sr-only" role="status" aria-live="polite">
        {view.phase === "over"
          ? `Chuyến bay kết thúc. ${view.score} điểm. Kỷ lục ${best}.`
          : inRun && view.paused
            ? "Chuyến bay tạm dừng."
            : view.countdown !== null
              ? `Bay tiếp sau ${view.countdown}.`
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
            aria-label="Đóng hướng dẫn"
          >
            <Icon name="close" />
          </button>
          <h2 id="help-title">Một chút trước khi bay</h2>
          <ol>
            <li>
              <strong>Chạm để vỗ cánh.</strong> Chạm vào vùng bay hoặc nhấn
              Space. Thả tay để hạ xuống.
            </li>
            <li>
              <strong>Luồn qua khe bìa.</strong> Mỗi khe được 1 điểm. Hạt hướng
              dương thêm 1 điểm. Chạm bìa hoặc mép trời là hạ cánh.
            </li>
            <li>
              <strong>Đón gió thật.</strong> Bánh xe quay nhanh, gió mạnh hơn.
              Hamster nghỉ, bạn vẫn bay chậm. Mất tín hiệu, chuyến bay tự tạm
              dừng.
            </li>
          </ol>
          <p>
            10 khe đầu rộng. Khe mới hẹp dần đến khe 30. Nhấn Escape hoặc nút
            tạm dừng để nghỉ.
          </p>
          <button type="button" className="primary" onClick={closeHelp}>
            Đã hiểu <Icon name="check" />
          </button>
        </div>
      </dialog>
    </>
  );
}
