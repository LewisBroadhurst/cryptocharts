"use client";

import { useEffect, useRef, useState } from "react";

import {
  DRAWING_COLORS,
  hasText,
  isPosition,
  MAX_TEXT,
  NOTE_PLACEHOLDER,
  TOOL_NAMES,
  type Drawing,
  type LineStyle,
} from "@/lib/charts/drawings";
import { cn } from "@/lib/utils";
import HoverTip from "@/components/base/HoverTip";
import ChartPopover, {
  ColourPicker,
  PopoverOption,
} from "@/components/charts/ChartPopover";
import {
  LockIcon,
  TrashIcon,
  ToolIcon,
} from "@/components/charts/ChartIcons";

const BUTTON =
  "flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-1.5 text-subtle-foreground transition hover:bg-secondary hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted";

const STYLES: readonly { id: LineStyle; label: string; dash?: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "dashed", label: "Dashed", dash: "5 3" },
  { id: "dotted", label: "Dotted", dash: "1 3" },
];

function Stroke({ width, dash }: { width: number; dash?: string }) {
  return (
    <svg viewBox="0 0 24 8" className="h-2 w-6" aria-hidden>
      <line
        x1={1}
        y1={4}
        x2={23}
        y2={4}
        stroke="currentColor"
        strokeWidth={width}
        strokeDasharray={dash}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * What a note or callout says, saved when the field loses focus or Enter is
 * pressed, so a word typed is one step to undo, not one per letter.
 */
function TextField({
  drawing,
  onChange,
}: {
  drawing: Drawing;
  onChange: (next: Drawing) => void;
}) {
  const [value, setValue] = useState(drawing.text ?? "");
  const field = useRef<HTMLInputElement>(null);
  const fresh = !drawing.text;
  // Keyed on the drawing and its text, so an undo shows the text it brings back.
  useEffect(() => {
    if (fresh) field.current?.focus();
    // A note just placed, with nothing written yet, takes the focus once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const save = () => {
    if (value !== (drawing.text ?? "")) onChange({ ...drawing, text: value });
  };
  return (
    <input
      ref={field}
      type="text"
      aria-label="Text"
      placeholder={NOTE_PLACEHOLDER}
      maxLength={MAX_TEXT}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          save();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          setValue(drawing.text ?? "");
          event.currentTarget.blur();
        }
      }}
      className="h-7 w-44 rounded-md border border-border bg-transparent px-2 text-xs text-foreground placeholder:text-faint-foreground focus:border-border-active focus:outline-hidden max-sm:w-32"
    />
  );
}

export default function DrawingToolbar({
  drawing,
  onChange,
  onRemove,
}: {
  drawing: Drawing;
  onChange: (next: Drawing) => void;
  onRemove: () => void;
}) {
  const coloured =
    !isPosition(drawing) &&
    drawing.kind !== "fib" &&
    drawing.kind !== "fibExtension";
  const lined =
    coloured &&
    drawing.kind !== "measure" &&
    drawing.kind !== "arrowUp" &&
    drawing.kind !== "arrowDown" &&
    drawing.kind !== "note" &&
    drawing.kind !== "priceRange" &&
    drawing.kind !== "dateRange";
  const style = STYLES.find((one) => one.id === drawing.style) ?? STYLES[0];

  return (
    <div
      role="toolbar"
      aria-label={`${TOOL_NAMES[drawing.kind]} settings`}
      className="absolute top-2 left-1/2 z-20 flex max-sm:top-auto max-sm:bottom-2 -translate-x-1/2 items-center gap-0.5 rounded-lg border border-border-strong bg-popover p-0.5 shadow-popover"
    >
      <span className="flex items-center gap-1.5 px-1.5 text-xs text-muted-foreground max-sm:hidden">
        <ToolIcon kind={drawing.kind} className="size-4" />
        {TOOL_NAMES[drawing.kind]}
      </span>
      <div aria-hidden className="mx-0.5 h-4 w-px bg-border max-sm:hidden" />
      {hasText(drawing.kind) && (
        <TextField
          key={`${drawing.id}:${drawing.text ?? ""}`}
          drawing={drawing}
          onChange={onChange}
        />
      )}
      {coloured && (
        <ColourPicker
          label="Colour"
          tip
          value={drawing.color}
          colors={DRAWING_COLORS}
          onPick={(color) => onChange({ ...drawing, color })}
          className={BUTTON}
        />
      )}
      {lined && (
        <ChartPopover
          label="Line"
          panelClassName="w-36"
          trigger={(props) => (
            <HoverTip control tip="Line">
              <button {...props} aria-label="Line" className={BUTTON}>
                <Stroke width={Math.min(drawing.width, 3)} dash={style.dash} />
                <span className="text-2xs tabular-nums">{drawing.width}px</span>
              </button>
            </HoverTip>
          )}
        >
          {(close) => (
            <>
              {([1, 2, 3, 4] as const).map((width) => (
                <PopoverOption
                  key={width}
                  size="xs"
                  active={drawing.width === width}
                  onPick={() => {
                    onChange({ ...drawing, width });
                    close();
                  }}
                >
                  <Stroke width={width} />
                  {width}px
                </PopoverOption>
              ))}
              <div className="my-1 h-px bg-border" />
              {STYLES.map((one) => (
                <PopoverOption
                  key={one.id}
                  size="xs"
                  active={drawing.style === one.id}
                  onPick={() => {
                    onChange({ ...drawing, style: one.id });
                    close();
                  }}
                >
                  <Stroke width={2} dash={one.dash} />
                  {one.label}
                </PopoverOption>
              ))}
            </>
          )}
        </ChartPopover>
      )}
      <HoverTip control tip={drawing.locked ? "Unlock" : "Lock"}>
        <button
          type="button"
          aria-label={drawing.locked ? "Unlock" : "Lock"}
          aria-pressed={Boolean(drawing.locked)}
          onClick={() => onChange({ ...drawing, locked: !drawing.locked })}
          className={cn(BUTTON, drawing.locked && "text-brand")}
        >
          <LockIcon open={!drawing.locked} className="size-4" />
        </button>
      </HoverTip>
      <HoverTip control tip="Remove">
        <button
          type="button"
          aria-label="Remove"
          onClick={onRemove}
          className={cn(BUTTON, "hover:text-negative")}
        >
          <TrashIcon className="size-4" />
        </button>
      </HoverTip>
    </div>
  );
}
