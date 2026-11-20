import { InformationCircleIcon } from "@heroicons/react/24/outline";

export default function TipMark() {
  return (
    <InformationCircleIcon
      aria-hidden
      data-tip-mark
      className="ml-[0.3em] inline size-[clamp(0.75rem,1.2em,1rem)] shrink-0 align-[-0.22em] text-faint-foreground transition group-hover/tip:text-body-foreground group-focus/tip:text-body-foreground"
    />
  );
}
