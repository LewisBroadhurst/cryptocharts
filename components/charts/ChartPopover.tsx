"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import HoverTip from "@/components/base/HoverTip";
import { PopoverContent } from "@/components/ui/popover";
import { useShutAway } from "@/hooks/useShutAway";

type TriggerProps = {
  type: "button";
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
  onClick: () => void;
};

export default function ChartPopover({
  trigger,
  label,
  side = "bottom",
  align = "start",
  className,
  panelClassName,
  children,
}: {
  trigger: (props: TriggerProps) => ReactNode;
  label: string;
  side?: "bottom" | "right" | "top";
  align?: "start" | "end";
  className?: string;
  panelClassName?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useShutAway(open, { inside: wrap, anchor: wrap, shut: close });

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      wrap.current?.querySelector<HTMLElement>("[aria-expanded]")?.focus();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  return (
    <div ref={wrap} className={cn("relative", className)}>
      {trigger({
        type: "button",
        "aria-expanded": open,
        "aria-controls": open ? id : undefined,
        onClick: () => setOpen((now) => !now),
      })}
      {open && (
        <PopoverContent
          id={id}
          role="group"
          aria-label={label}
          className={cn(
            "absolute z-30",
            side === "bottom" && "top-full mt-1.5",
            side === "top" && "bottom-full mb-1.5",
            side === "right" && "top-0 left-full ml-1.5",
            side !== "right" && (align === "start" ? "left-0" : "right-0"),
            panelClassName,
          )}
        >
          {children(close)}
        </PopoverContent>
      )}
    </div>
  );
}

export function PopoverOption({
  active,
  onPick,
  size = "sm",
  className,
  children,
}: {
  active: boolean;
  onPick: () => void;
  size?: "xs" | "sm";
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-body-foreground hover:bg-secondary",
        size === "xs" ? "text-xs" : "text-sm",
        className,
        active && "text-brand",
      )}
    >
      {children}
    </button>
  );
}

export function ColourPicker({
  label,
  tip = false,
  value,
  colors,
  onPick,
  className,
}: {
  label: string;
  tip?: boolean;
  value: string;
  colors: readonly string[];
  onPick: (color: string) => void;
  className: string;
}) {
  return (
    <ChartPopover
      label="Colour"
      panelClassName="grid w-max grid-cols-4 gap-1.5"
      trigger={(props) => {
        const button = (
          <button {...props} aria-label={label} className={className}>
            <span
              className="size-3.5 rounded-full ring-1 ring-white/20"
              style={{ background: value }}
            />
          </button>
        );
        return tip ? (
          <HoverTip control tip={label}>
            {button}
          </HoverTip>
        ) : (
          button
        );
      }}
    >
      {(close) =>
        colors.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={value === color}
            onClick={() => {
              onPick(color);
              close();
            }}
            className={cn(
              "size-6 rounded-full ring-offset-2 ring-offset-popover transition hover:scale-110 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted",
              value === color && "ring-2 ring-foreground",
            )}
            style={{ background: color }}
          />
        ))
      }
    </ChartPopover>
  );
}
