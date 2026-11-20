export const PANEL_HEADING =
  "text-xs font-medium uppercase tracking-wide text-muted-foreground";

export const EYEBROW =
  "font-mono text-2xs font-medium uppercase tracking-caps text-muted-foreground";

export const PICK_CHIP =
  "inline-flex rounded-full border border-border px-2.5 py-1 text-xs text-body-foreground transition hover:border-border-strong hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted";

export const EDGE_TAG =
  "rounded-full border border-border bg-background px-2 text-2xs leading-4 tracking-wide whitespace-nowrap text-faint-foreground uppercase";

export const SUBHEAD =
  "text-2xs font-medium uppercase tracking-caps text-muted-foreground";

export const RAIL_ACTION =
  "rounded-md bg-secondary px-2 py-1 text-xs font-medium text-foreground transition hover:bg-secondary/70 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted";

export const HERO_CAPSULE =
  "inline-flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-subtle-foreground";

export const HERO_DOT = "size-1.5 rounded-full bg-brand";

export const HERO_GLOW =
  "pointer-events-none absolute inset-x-[-1rem] -top-24 sm:inset-x-[-1.25rem] h-96 bg-[radial-gradient(55%_50%_at_30%_40%,var(--brand-wash),transparent)] [mask-composite:intersect] [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent),linear-gradient(to_bottom,transparent,black_30%,black_55%,transparent)] [-webkit-mask-composite:source-in]";

export const GLOW_PANEL =
  "rounded-xl border border-border bg-[radial-gradient(600px_220px_at_12%_-10%,var(--brand-wash),transparent_70%)] p-5";

export const STEP_NUMBER = "font-mono text-xs font-semibold text-brand";

export const stepNumber = (step: number) => String(step).padStart(2, "0");

export const SECTION_TITLE =
  "text-lg font-semibold tracking-tight text-balance text-foreground";

export const ACTION_LINK =
  "font-medium text-brand transition hover:text-brand-strong";

export const INLINE_LINK = `${ACTION_LINK} underline decoration-brand/40 underline-offset-4 hover:decoration-brand-strong`;

export const FOLD_TOGGLE =
  "shrink-0 text-xs font-medium text-brand transition group-hover:text-brand-strong";

export const SECTION_HEADLINE =
  "mt-2 max-w-2xl text-2xl font-semibold leading-display tracking-tight text-balance text-foreground sm:text-4xl";

export const SECTION_INTRO =
  "mt-2 max-w-2xl text-base leading-normal text-pretty text-muted-foreground sm:text-lg";

const QUIET_BASE =
  "gap-1 [&_[data-slot=button]]:border-transparent [&_[data-slot=button]]:px-1.5 [&_[data-slot=button]:hover]:bg-secondary [&_[data-slot=button]:hover]:text-accent-foreground [&_summary]:border-transparent [&_summary]:px-1.5 [&_summary:hover]:bg-secondary [&_summary:hover]:text-accent-foreground";

export const QUIET_ACTIONS = `${QUIET_BASE} [&_[data-slot=button]]:text-muted-foreground [&_summary]:text-muted-foreground`;

export const FAINT_ACTIONS = `${QUIET_BASE} [&_[data-slot=button]]:text-faint-foreground [&_summary]:text-faint-foreground`;

export const RULED_CHECKS =
  "space-y-0 divide-y divide-border/70 [&>li]:py-2.5 [&>li:first-child]:pt-0 [&>li:last-child]:pb-0";

// Ruled cells, two to a row; only the last row's cells drop their bottom gap.
// Tailwind reads whole class names, so each list is written out: change one,
// change all three.

export const RULED_CELLS_WIDE =
  "space-y-0 max-lg:divide-y max-lg:divide-border/70 max-lg:border-t max-lg:border-border/70 max-lg:[&>li]:py-2.5 max-lg:[&>li:last-child]:pb-0 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:[&>li]:border-t lg:[&>li]:border-border/70 lg:[&>li]:pt-3 lg:[&>li]:pb-3.5 lg:[&>li:last-child]:pb-0 lg:[&>li:nth-last-child(2):nth-child(odd)]:pb-0";

export const RULED_CELLS_CONTAINED =
  "space-y-0 @max-lg:divide-y @max-lg:divide-border/70 @max-lg:border-t @max-lg:border-border/70 @max-lg:[&>li]:py-2.5 @max-lg:[&>li:last-child]:pb-0 @lg:grid @lg:grid-cols-2 @lg:gap-x-6 @lg:[&>li]:border-t @lg:[&>li]:border-border/70 @lg:[&>li]:pt-3 @lg:[&>li]:pb-3.5 @lg:[&>li:last-child]:pb-0 @lg:[&>li:nth-last-child(2):nth-child(odd)]:pb-0";

export const RULED_CELLS =
  "grid gap-x-6 space-y-0 sm:grid-cols-2 [&>li]:border-t [&>li]:border-border/70 [&>li]:pt-3 [&>li]:pb-3.5 [&>li:last-child]:pb-0 sm:[&>li:nth-last-child(2):nth-child(odd)]:pb-0";
