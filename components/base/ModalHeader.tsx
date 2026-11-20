"use client";

import type { ComponentProps, ReactNode, RefObject } from "react";

import { cn } from "@/lib/utils";
import CloseButton from "@/components/base/CloseButton";

export default function ModalHeader({
  id,
  title,
  onClose,
  closeRef,
  closeTone = "header",
  className = "",
  titleClassName = "text-sm font-medium text-emphasis-foreground",
}: {
  id: string;
  title: ReactNode;
  onClose: () => void;
  closeRef?: RefObject<HTMLButtonElement | null>;
  closeTone?: ComponentProps<typeof CloseButton>["tone"];
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", className)}>
      <h2 id={id} className={titleClassName}>
        {title}
      </h2>
      <CloseButton ref={closeRef} onClose={onClose} tone={closeTone} />
    </div>
  );
}
