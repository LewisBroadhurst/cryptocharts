"use client";

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";

import TipMark from "@/components/base/TipMark";
import { TIP_TARGET } from "@/components/base/tipStyles";
import Tooltip from "@/components/base/Tooltip";
import { useShutAway } from "@/hooks/useShutAway";

const TERM = `group/tip cursor-help ${TIP_TARGET}`;

const NO_HOVER = "(hover: none)";
const SAME_TAP_MS = 500;

let open: { owner: object; hide: () => void } | null = null;

function focusVisible(target: EventTarget): boolean {
  try {
    return (target as Element).matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * A control acts on a tap, which on a phone leaves its tip unread: nothing
 * hovers there. So on such a screen the first tap opens the tip and goes no
 * further, and a tap while it is showing is the control's own.
 */
export default function HoverTip({
  id,
  tip,
  control = false,
  svg = false,
  mark = true,
  className,
  children,
}: {
  id?: string;
  /** A string is set in the panel's body style; a node is rendered as given.
      Nothing means no tooltip, so a conditional hint needs no branch. */
  tip?: ReactNode;
  control?: boolean;
  /** Wraps a control inside an SVG, where only an SVG element renders. */
  svg?: boolean;
  mark?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const generated = useId();
  const tipId = id ?? `tip${generated}`;
  const [rect, setRect] = useState<DOMRect | null>(null);
  const owner = useRef({});
  const wrapper = useRef<HTMLSpanElement & SVGGElement>(null);
  const anchored = useRef<Element | null>(null);
  const shownAt = useRef(0);
  const hide = useCallback(() => {
    if (open?.owner === owner.current) open = null;
    setRect(null);
  }, []);
  const show = (event: { currentTarget: Element }) => {
    const target = event.currentTarget;
    // A bare control wrapper is `display: contents`, which has no box of its
    // own, so the panel anchors to the control inside it.
    const anchor =
      control && !className ? (target.firstElementChild ?? target) : target;
    open?.hide();
    open = { owner: owner.current, hide };
    shownAt.current = performance.now();
    anchored.current = anchor;
    setRect(anchor.getBoundingClientRect());
  };
  useEffect(() => hide, [hide]);
  useShutAway(rect, { inside: wrapper, anchor: anchored, shut: hide });
  const dismissed = useRef(false);
  const dismiss = () => {
    dismissed.current = true;
    hide();
  };
  const reset = () => {
    dismissed.current = false;
    hide();
  };
  const tap = (event: MouseEvent<Element>) => {
    const showing = open?.owner === owner.current;
    // A touch browser sends a hover ahead of the tap's click, so the tip may
    // already be up from this same tap. Only one a while old was there to be
    // read, and only then is the tap meant for the control.
    const read = showing && performance.now() - shownAt.current > SAME_TAP_MS;
    // No click count is Enter on a focused control, whose tip the focus
    // already opened: a phone or tablet can have a keyboard too.
    const keyed = event.detail === 0;
    const empty = tip == null || tip === "";
    if (empty || keyed || read || !window.matchMedia(NO_HOVER).matches) {
      dismiss();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dismissed.current = false;
    if (!showing) show(event);
  };
  const showOnFocus = (event: FocusEvent<Element>) => {
    if (dismissed.current || (control && !focusVisible(event.target))) return;
    show(event);
  };

  // A <g> has no box to remove, and older iPhone WebKit draws nothing inside
  // one set to `display: contents`, so only an HTML wrapper takes it.
  const wrapperClass = control
    ? (className ?? (svg ? undefined : "contents"))
    : `${TERM} ${className ?? "inline-block"}`;

  const Wrapper = svg ? "g" : "span";
  const said = tip != null && tip !== "";
  // A control's word tip goes on the control, so a screen reader has it unopened.
  const words = said && typeof tip === "string" ? tip : undefined;
  const described = {
    "aria-description": words,
    "aria-describedby": said && !words ? tipId : undefined,
  };
  const target =
    control && isValidElement(children)
      ? cloneElement(
          children as ReactElement<{
            "aria-description"?: string;
            "aria-describedby"?: string;
          }>,
          described,
        )
      : children;

  return (
    <>
      <Wrapper
        ref={wrapper}
        data-tip-trigger=""
        tabIndex={control ? undefined : 0}
        aria-describedby={control ? undefined : tipId}
        onMouseEnter={(event) => {
          if (!dismissed.current) show(event);
        }}
        onMouseLeave={reset}
        onFocus={showOnFocus}
        onBlur={reset}
        onClick={control ? undefined : show}
        onClickCapture={control ? tap : undefined}
        className={wrapperClass}
      >
        {target}
        {!control && mark && said && <TipMark />}
      </Wrapper>
      {rect && said && (
        <Tooltip id={tipId} rect={rect}>
          {typeof tip === "string" ? (
            <span className="block text-xs leading-relaxed text-subtle-foreground">
              {tip}
            </span>
          ) : (
            tip
          )}
        </Tooltip>
      )}
    </>
  );
}
