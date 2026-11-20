"use client";

import { useState, type ReactNode } from "react";
import { ChevronRightIcon } from "@heroicons/react/20/solid";

import { TOOL_NAMES, type DrawingKind } from "@/lib/charts/drawings";
import { cn } from "@big-shared/ui/cn";
import HoverTip from "@big-shared/ui/hover-tip";
import ChartPopover, { PopoverOption } from "@/components/charts/ChartPopover";
import {
  CursorIcon,
  EyeIcon,
  LockIcon,
  MagnetIcon,
  RedoIcon,
  ToolIcon,
  TrashIcon,
  UndoIcon,
} from "@/components/charts/ChartIcons";

export const TOOL_KEYS: Partial<
  Record<DrawingKind, { code: string; label: string }>
> = {
  trend: { code: "KeyT", label: "Alt T" },
  horizontal: { code: "KeyH", label: "Alt H" },
  horizontalRay: { code: "KeyJ", label: "Alt J" },
  vertical: { code: "KeyV", label: "Alt V" },
  fib: { code: "KeyF", label: "Alt F" },
  rectangle: { code: "KeyR", label: "Alt R" },
  long: { code: "KeyL", label: "Alt L" },
  short: { code: "KeyS", label: "Alt S" },
  measure: { code: "KeyM", label: "Alt M" },
  arrow: { code: "KeyA", label: "Alt A" },
  elliottImpulse: { code: "KeyE", label: "Alt E" },
  channel: { code: "KeyC", label: "Alt C" },
  note: { code: "KeyN", label: "Alt N" },
  brush: { code: "KeyB", label: "Alt B" },
};

export const TOOL_GROUPS: readonly {
  label: string;
  tools: readonly DrawingKind[];
}[] = [
  {
    label: "Lines",
    tools: [
      "trend",
      "ray",
      "extended",
      "horizontal",
      "horizontalRay",
      "vertical",
      "channel",
    ],
  },
  { label: "Fibonacci", tools: ["fib", "fibExtension", "fibTimeZone"] },
  {
    label: "Elliott waves",
    tools: [
      "elliottImpulse",
      "elliottCorrection",
      "elliottTriangle",
      "elliottCombo",
    ],
  },
  { label: "Arrows", tools: ["arrow", "arrowUp", "arrowDown"] },
  { label: "Notes", tools: ["note", "callout", "brush"] },
  { label: "Shapes", tools: ["rectangle"] },
  { label: "Positions", tools: ["long", "short"] },
  { label: "Measure", tools: ["measure", "priceRange", "dateRange"] },
];

const RAIL_BUTTON =
  "flex size-9 items-center justify-center rounded-md text-subtle-foreground transition hover:bg-secondary hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted";
const RAIL_ON = "bg-secondary text-brand hover:text-brand";

function tipFor(kind: DrawingKind) {
  const key = TOOL_KEYS[kind];
  return (
    <span className="flex items-center gap-2">
      {TOOL_NAMES[kind]}
      {key && (
        <kbd className="rounded-xs border border-border-strong px-1 font-mono text-2xs text-muted-foreground">
          {key.label}
        </kbd>
      )}
    </span>
  );
}

export type RailProps = {
  tool: DrawingKind | null;
  onTool: (tool: DrawingKind | null) => void;
  magnet: boolean;
  onMagnet: (on: boolean) => void;
  hidden: boolean;
  onHidden: (on: boolean) => void;
  locked: boolean;
  onLocked: (on: boolean) => void;
  hasDrawings: boolean;
  onClear: () => void;
};

function ToolRow({
  kind,
  active,
  onPick,
}: {
  kind: DrawingKind;
  active: boolean;
  onPick: () => void;
}) {
  const key = TOOL_KEYS[kind];
  return (
    <PopoverOption
      active={active}
      onPick={onPick}
      className={cn(
        "transition hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted",
        active && "hover:text-brand",
      )}
    >
      <ToolIcon kind={kind} className="size-5 shrink-0" />
      <span className="flex-1 whitespace-nowrap">{TOOL_NAMES[kind]}</span>
      {key && (
        <span className="font-mono text-2xs whitespace-nowrap text-faint-foreground">
          {key.label}
        </span>
      )}
    </PopoverOption>
  );
}

function Toggle({
  on,
  onChange,
  tip,
  children,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  tip: string;
  children: ReactNode;
}) {
  return (
    <HoverTip control tip={tip}>
      <button
        type="button"
        aria-label={tip}
        aria-pressed={on}
        onClick={() => onChange(!on)}
        className={cn(RAIL_BUTTON, on && RAIL_ON)}
      >
        {children}
      </button>
    </HoverTip>
  );
}

export default function ToolRail(props: RailProps) {
  const { tool, onTool } = props;
  const [chosen, setChosen] = useState<Record<string, DrawingKind>>({});

  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      aria-orientation="vertical"
      className="relative z-10 flex h-full shrink-0 flex-col items-center gap-0.5 border-r border-border px-1.5 py-1.5"
    >
      <Toggle on={tool === null} onChange={() => onTool(null)} tip="Cursor">
        <CursorIcon />
      </Toggle>
      <div aria-hidden className="my-1 h-px w-6 bg-border" />
      {TOOL_GROUPS.map((group) => {
        const current =
          group.tools.find((one) => one === tool) ??
          chosen[group.label] ??
          group.tools[0];
        const on = tool !== null && group.tools.includes(tool);
        const pick = (kind: DrawingKind) => {
          setChosen((now) => ({ ...now, [group.label]: kind }));
          onTool(kind);
        };
        return (
          <div
            key={group.label}
            className="group/tool relative flex items-center"
          >
            <HoverTip control tip={tipFor(current)}>
              <button
                type="button"
                aria-label={TOOL_NAMES[current]}
                aria-pressed={on}
                onClick={() => (on ? onTool(null) : pick(current))}
                className={cn(RAIL_BUTTON, on && RAIL_ON)}
              >
                <ToolIcon kind={current} />
              </button>
            </HoverTip>
            {group.tools.length > 1 && (
              <ChartPopover
                label={group.label}
                side="right"
                className="absolute top-0 -right-1.5 h-full"
                panelClassName="w-64 -top-1.5"
                trigger={(props) => (
                  <button
                    {...props}
                    aria-label={`More ${group.label.toLowerCase()}`}
                    className="flex h-full w-2 items-center justify-center rounded-xs text-faint-foreground opacity-0 transition group-hover/tool:opacity-100 hover:bg-secondary hover:text-foreground focus-visible:opacity-100 focus:outline-hidden pointer-coarse:opacity-100 aria-expanded:opacity-100"
                  >
                    <ChevronRightIcon aria-hidden className="size-2.5" />
                  </button>
                )}
              >
                {(close) => (
                  <>
                    <p className="px-2 pt-1 pb-1.5 text-2xs font-medium tracking-caps text-muted-foreground uppercase">
                      {group.label}
                    </p>
                    {group.tools.map((kind) => (
                      <ToolRow
                        key={kind}
                        kind={kind}
                        active={tool === kind}
                        onPick={() => {
                          pick(kind);
                          close();
                        }}
                      />
                    ))}
                  </>
                )}
              </ChartPopover>
            )}
          </div>
        );
      })}
      <div aria-hidden className="my-1 h-px w-6 bg-border" />
      <Toggle on={props.magnet} onChange={props.onMagnet} tip="Snap to prices">
        <MagnetIcon />
      </Toggle>
      <Toggle
        on={props.locked}
        onChange={props.onLocked}
        tip="Lock all drawings"
      >
        <LockIcon open={!props.locked} />
      </Toggle>
      <Toggle
        on={props.hidden}
        onChange={props.onHidden}
        tip="Hide all drawings"
      >
        <EyeIcon off={props.hidden} />
      </Toggle>
      <HoverTip control tip="Remove all drawings">
        <button
          type="button"
          aria-label="Remove all drawings"
          disabled={!props.hasDrawings}
          onClick={props.onClear}
          className={cn(
            RAIL_BUTTON,
            "disabled:opacity-40 disabled:hover:bg-transparent",
          )}
        >
          <TrashIcon />
        </button>
      </HoverTip>
    </div>
  );
}

export function ToolMenu(
  props: RailProps & {
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
  },
) {
  const { tool, onTool } = props;
  return (
    <ChartPopover
      label="Drawing tools"
      align="end"
      panelClassName="w-64 max-h-[70dvh] overflow-y-auto"
      trigger={(props) => (
        <button
          {...props}
          aria-label="Draw"
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-subtle-foreground transition hover:bg-secondary hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted",
            tool && "bg-secondary text-brand hover:text-brand",
          )}
        >
          <ToolIcon kind={tool ?? "trend"} className="size-5" />
        </button>
      )}
    >
      {(close) => (
        <>
          <PopoverOption
            active={tool === null}
            onPick={() => {
              onTool(null);
              close();
            }}
            className="transition"
          >
            <CursorIcon className="size-5" />
            Cursor
          </PopoverOption>
          {TOOL_GROUPS.map((group) => (
            <div key={group.label} className="mt-1 border-t border-border pt-1">
              {group.tools.map((kind) => (
                <ToolRow
                  key={kind}
                  kind={kind}
                  active={tool === kind}
                  onPick={() => {
                    onTool(kind);
                    close();
                  }}
                />
              ))}
            </div>
          ))}
          <div className="mt-1 grid grid-cols-2 gap-1 border-t border-border pt-1.5">
            {(
              [
                ["Snap", props.magnet, props.onMagnet],
                ["Lock all", props.locked, props.onLocked],
                ["Hide all", props.hidden, props.onHidden],
              ] as const
            ).map(([label, on, set]) => (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={() => set(!on)}
                className={cn(
                  "rounded-md border border-border px-2 py-1.5 text-xs text-subtle-foreground",
                  on && "border-border-active bg-secondary text-foreground",
                )}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              disabled={!props.hasDrawings}
              onClick={() => {
                props.onClear();
                close();
              }}
              className="rounded-md border border-border px-2 py-1.5 text-xs text-negative disabled:opacity-40"
            >
              Remove all
            </button>
            {(
              [
                ["Undo", props.canUndo, props.onUndo, UndoIcon],
                ["Redo", props.canRedo, props.onRedo, RedoIcon],
              ] as const
            ).map(([label, can, act, Glyph]) => (
              <button
                key={label}
                type="button"
                disabled={!can}
                onClick={act}
                className="flex items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-subtle-foreground disabled:opacity-40"
              >
                <Glyph className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </ChartPopover>
  );
}
