import type { Ref } from "react";
export function Icon({
  name,
  className = "",
}: {
  name:
    | "play"
    | "pause"
    | "wind"
    | "help"
    | "close"
    | "arrow"
    | "medal"
    | "seed"
    | "check"
    | "signal";
  className?: string;
}) {
  const paths = {
    play: <path d="m9 5 11 7-11 7Z" />,
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    wind: (
      <>
        <path d="M3 8h12c5 0 5-6 1-6-2 0-3 1-3 3M2 12h17c5 0 4 8 0 8-2 0-3-1-3-3M5 16h5" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16.5v.1" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    medal: (
      <>
        <path d="m6 3 2 6m10-6-2 6M9 2h6" />
        <circle cx="12" cy="15" r="7" />
        <path d="m12 11 1.2 2.5 2.8.4-2 2 .5 2.6-2.5-1.3-2.5 1.3.5-2.6-2-2 2.8-.4Z" />
      </>
    ),
    seed: (
      <>
        <path d="M8 3c9 0 16 12 8 17C8 25 1 13 8 3Z" />
        <path d="M8 7c1 5 3 8 6 10" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    signal: (
      <>
        <path d="M4 18v-3m5 3v-6m5 6V9m5 9V5" />
      </>
    ),
  };
  return (
    <svg
      className={`icon ${className}`}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function Wheel({
  wheelRef,
  state,
  moving,
}: {
  wheelRef?: Ref<SVGGElement>;
  state: "running" | "resting" | "unknown";
  moving: boolean;
}) {
  return (
    <svg
      className={`wheel is-${state} ${moving ? "is-moving" : ""}`}
      data-state={state}
      width="52"
      height="56"
      viewBox="0 0 44 48"
      fill="none"
      aria-hidden="true"
    >
      {state === "unknown" ? (
        <g
          className="unknown-signal"
          stroke="#706351"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="22" cy="22" r="18" fill="#f9f2d8" />
          <path d="M11 19q11-11 22 0M15 24q7-7 14 0M9 35 35 9" />
          <circle cx="22" cy="29" r="1.5" fill="#706351" stroke="none" />
        </g>
      ) : (
        <>
          <path
            d="M22 23v21m-11 1h22"
            stroke="#5f7056"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle
            cx="22"
            cy="21"
            r="18"
            fill="#f9f2d8"
            stroke="#80684b"
            strokeWidth="2.5"
          />
          <g className="wheel-rotor" ref={wheelRef}>
            <circle cx="22" cy="21" r="14" stroke="#baa074" strokeWidth="1.3" />
            {[0, 60, 120].map((a) => (
              <path
                key={a}
                transform={`rotate(${a} 22 21)`}
                d="M22 7v28"
                stroke="#baa074"
                strokeWidth="1.5"
              />
            ))}
          </g>
          <circle cx="22" cy="21" r="3" fill="#80684b" />
          {state === "resting" ? (
            <g
              className="sleeping-hamster"
              stroke="#4c392e"
              strokeWidth="1.1"
              strokeLinecap="round"
            >
              <path
                d="M10 29c-1-13 21-15 23-3 2 11-22 12-23 3Z"
                fill="#fff3d7"
              />
              <path d="M14 29q-3-8 4-10 7-2 9 7 1 6-7 7" fill="#f5dcac" />
              <circle cx="17" cy="21" r="3" fill="#efb4a0" />
              <path d="M21 27q2 2 4 0" fill="none" />
              <path d="M11 30q4 4 9 0" fill="none" />
            </g>
          ) : (
            <g
              className="running-hamster"
              stroke="#4c392e"
              strokeWidth="1.1"
              strokeLinecap="round"
            >
              <g className="hamster-paws">
                <path d="m15 31-3 3m6-3 2 3m5-3-2 3m6-4 3 3" />
              </g>
              <path
                d="M10 26c-2-9 11-12 18-6 9 4 7 10-2 11-10 2-15-1-16-5Z"
                fill="#fff3d7"
              />
              <circle cx="25" cy="20" r="3.5" fill="#f5dcac" />
              <circle cx="25" cy="20" r="1.7" fill="#efb4a0" stroke="none" />
              <circle cx="30" cy="25" r="1" fill="#4c392e" stroke="none" />
              <ellipse
                cx="28"
                cy="28"
                rx="2.5"
                ry="1.5"
                fill="#eaa06f"
                stroke="none"
              />
              <path d="m33 27 2 1" />
            </g>
          )}
        </>
      )}
    </svg>
  );
}
export function BrandMark() {
  return (
    <svg
      width="39"
      height="39"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="10"
        r="6"
        fill="#f5dcac"
        stroke="#4c392e"
        strokeWidth="1.6"
      />
      <circle
        cx="29"
        cy="10"
        r="6"
        fill="#f5dcac"
        stroke="#4c392e"
        strokeWidth="1.6"
      />
      <path
        d="M5 25C2 7 36 5 36 24c0 15-31 16-31 1Z"
        fill="#fff1cc"
        stroke="#4c392e"
        strokeWidth="1.8"
      />
      <ellipse cx="10" cy="26" rx="5" ry="3" fill="#eaa06f" />
      <ellipse cx="31" cy="25" rx="4" ry="3" fill="#eaa06f" />
      <circle cx="14" cy="20" r="2" fill="#4c392e" />
      <circle cx="27" cy="19" r="2" fill="#4c392e" />
      <path
        d="m19 24 2 2 2-2m-5 5q3 3 6-1"
        stroke="#4c392e"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
