"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

// Typography is restated, not inherited: a dialog is promoted to the top layer
// but stays where it is in the DOM, so a panel opened from the table's EMA200
// band would inherit that header's uppercase, centred, letter-spaced type.
const SHELL =
  "fixed inset-0 m-0 h-full max-h-full w-full max-w-full bg-transparent " +
  "text-left text-base font-normal normal-case tracking-normal whitespace-normal text-foreground";

export default function Modal({
  labelledBy,
  onClose,
  returnFocusTo,
  dismissOnBackdrop = false,
  className = "",
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  returnFocusTo?: RefObject<HTMLElement | null>;
  dismissOnBackdrop?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const returnFocusRef = useRef(returnFocusTo);
  useEffect(() => {
    returnFocusRef.current = returnFocusTo;
  }, [returnFocusTo]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      // React unmounts a parent before its children, so a modal opened inside
      // this one is still open here and keeps the page inert: close it first,
      // or the focus handed back below goes nowhere.
      for (const inner of dialog.querySelectorAll<HTMLDialogElement>(
        "dialog[open]",
      ))
        inner.close();
      dialog.close();
      returnFocusRef.current?.current?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      data-modal
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={
        dismissOnBackdrop
          ? (event) => {
              if (event.target === event.currentTarget) onClose();
            }
          : undefined
      }
      className={`${SHELL} ${className}`}
    >
      {children}
    </dialog>
  );
}
