"use client";

import { useEffect, type RefObject } from "react";

const SLACK_PX = 1;

export function useShutAway(
  open: unknown,
  {
    inside,
    anchor,
    shut,
  }: {
    inside: RefObject<Element | null>;
    anchor: RefObject<Element | null>;
    shut: () => void;
  },
) {
  useEffect(() => {
    if (!open) return;
    const at = anchor.current?.getBoundingClientRect();
    const onPointerDown = (event: PointerEvent) => {
      if (!inside.current?.contains(event.target as Node)) shut();
    };
    const onScroll = () => {
      const now = anchor.current?.getBoundingClientRect();
      if (
        !at ||
        !now ||
        Math.abs(now.top - at.top) > SLACK_PX ||
        Math.abs(now.left - at.left) > SLACK_PX
      )
        shut();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, inside, anchor, shut]);
}
