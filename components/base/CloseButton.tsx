"use client";

import type { Ref } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

const TONE = {
  header:
    "rounded-sm px-1.5 text-muted-foreground transition hover:text-emphasis-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted",
  dialog:
    "rounded-sm p-1 text-muted-foreground hover:bg-surface hover:text-emphasis-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted",
  panel:
    "rounded-sm p-0.5 text-faint-foreground transition hover:bg-secondary hover:text-body-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted",
};

export default function CloseButton({
  onClose,
  label = "Close",
  tone,
  ref,
}: {
  onClose: () => void;
  label?: string;
  tone: keyof typeof TONE;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClose}
      aria-label={label}
      className={TONE[tone]}
    >
      <XMarkIcon aria-hidden className="size-4" />
    </button>
  );
}
