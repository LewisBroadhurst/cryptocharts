"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { PopoverContent } from "@/components/ui/popover";

const WIDTH = 288;
const GAP = 8;
const MARGIN = 8;

/**
 * Where a tooltip has to be portalled to be seen.
 *
 * `showModal()` promotes a dialog to the browser's top layer, which paints
 * above every normal-flow element whatever its z-index. A tooltip portalled to
 * `body` therefore renders *behind* an open modal, so it goes inside the
 * dialog instead. The last open one wins: a modal opened from a modal is the
 * one on top. A full-screen element hides everything outside it in the same
 * way, so with no dialog open a tooltip goes inside that. Still
 * `position: fixed`, so the anchor's viewport coordinates hold either way.
 */
function host(): Element {
  const dialogs = document.querySelectorAll("dialog[open]");
  return (
    dialogs[dialogs.length - 1] ?? document.fullscreenElement ?? document.body
  );
}

export default function Tooltip({
  id,
  rect,
  children,
}: {
  id: string;
  rect: DOMRect;
  children: ReactNode;
}) {
  const below = rect.bottom + GAP;
  const spaceBelow = window.innerHeight - rect.bottom;
  const flip = spaceBelow < 180 && rect.top > spaceBelow;
  const left = Math.min(
    Math.max(MARGIN, rect.left),
    window.innerWidth - WIDTH - MARGIN,
  );

  return createPortal(
    <PopoverContent
      id={id}
      role="tooltip"
      style={{
        position: "fixed",
        left,
        ...(flip
          ? { bottom: window.innerHeight - rect.top + GAP }
          : { top: below }),
        width: "max-content",
        maxWidth: WIDTH,
      }}
      padding="md"
      className="pointer-events-none z-50"
    >
      {children}
    </PopoverContent>,
    host(),
  );
}
