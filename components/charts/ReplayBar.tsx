"use client";

import { REPLAY_SPEEDS, type Replay, type ReplaySpeed } from "@/lib/charts/replay";
import { chartStamp } from "@/lib/dates";
import { cn } from "@big-shared/ui/cn";
import HoverTip from "@big-shared/ui/hover-tip";
import {
  CloseIcon,
  PauseIcon,
  PlayIcon,
  StepBackIcon,
  StepForwardIcon,
} from "@/components/charts/ChartIcons";

const BUTTON =
  "flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-xs font-medium text-subtle-foreground transition hover:bg-secondary hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted disabled:opacity-40 disabled:hover:bg-transparent";

/** The replay's controls, floating over the bottom of the chart. */
export default function ReplayBar({
  replay,
  caughtUp,
  atStart,
  onPlay,
  onStep,
  onSpeed,
  onExit,
}: {
  replay: Replay;
  caughtUp: boolean;
  atStart: boolean;
  onPlay: (playing: boolean) => void;
  onStep: (by: 1 | -1) => void;
  onSpeed: (speed: ReplaySpeed) => void;
  onExit: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Replay"
      className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-border-strong bg-popover px-1 py-1 shadow-popover"
    >
      <HoverTip control tip="Back one bar">
        <button
          type="button"
          aria-label="Back one bar"
          disabled={atStart}
          onClick={() => onStep(-1)}
          className={BUTTON}
        >
          <StepBackIcon className="size-4" />
        </button>
      </HoverTip>
      <HoverTip control tip={replay.playing ? "Pause" : "Play"}>
        <button
          type="button"
          aria-label={replay.playing ? "Pause" : "Play"}
          disabled={caughtUp && !replay.playing}
          onClick={() => onPlay(!replay.playing)}
          className={cn(BUTTON, "text-foreground")}
        >
          {replay.playing ? (
            <PauseIcon className="size-4" />
          ) : (
            <PlayIcon className="size-4" />
          )}
        </button>
      </HoverTip>
      <HoverTip control tip="Forward one bar (Shift →)">
        <button
          type="button"
          aria-label="Forward one bar"
          disabled={caughtUp}
          onClick={() => onStep(1)}
          className={BUTTON}
        >
          <StepForwardIcon className="size-4" />
        </button>
      </HoverTip>
      <div role="group" aria-label="Speed" className="flex gap-0.5 border-l border-border pl-1">
        {REPLAY_SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            aria-pressed={replay.speed === speed}
            aria-label={`${speed} bar${speed === 1 ? "" : "s"} a second`}
            onClick={() => onSpeed(speed)}
            className={cn(BUTTON, "tabular-nums", replay.speed === speed && "text-brand")}
          >
            {speed}×
          </button>
        ))}
      </div>
      <p
        aria-live="polite"
        className="min-w-36 border-l border-border px-2 text-xs tabular-nums text-muted-foreground"
      >
        {caughtUp ? "Live: " : ""}
        <span className="text-foreground">{chartStamp(replay.at)}</span>
      </p>
      <HoverTip control tip="Back to live">
        <button
          type="button"
          aria-label="Back to live"
          onClick={onExit}
          className={cn(BUTTON, "gap-1 border-l border-border pl-2")}
        >
          <CloseIcon className="size-4" />
          <span className="max-sm:hidden">Live</span>
        </button>
      </HoverTip>
    </div>
  );
}
