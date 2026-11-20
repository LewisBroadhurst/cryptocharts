import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const dialogVariants = cva(
  "rounded-lg border border-border-strong bg-popover shadow-popover",
  {
    variants: {
      padding: { none: "", md: "p-4", lg: "p-5" },
    },
    defaultVariants: { padding: "lg" },
  },
);

function DialogContent({
  className,
  padding,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof dialogVariants>) {
  return (
    <div
      data-slot="dialog-content"
      className={cn(dialogVariants({ padding }), className)}
      {...props}
    />
  );
}

/**
 * The layer is `overflow-clip`, not `overflow-hidden`: a hidden box can still
 * be scrolled, and `showModal` scrolls it to the control it focuses, which
 * starts the slide off the edge. That pulled the panel most of the way in on
 * the first frame and left the slide to stutter over what remained.
 */
const DRAWER_LAYER =
  "items-stretch justify-end overflow-clip backdrop:bg-black/50 motion-safe:backdrop:animate-[backdrop-in_200ms_ease-out]";

const DRAWER_PANEL = cn(
  dialogVariants({ padding: "md" }),
  "h-full w-full rounded-none border-y-0 border-r-0 bg-background motion-safe:animate-[drawer-in_200ms_ease-out]",
);

const CENTERED_LAYER = "items-center justify-center backdrop:bg-black/70";

const CENTERED_PANEL = "border-border bg-background shadow-dialog";

export {
  CENTERED_LAYER,
  CENTERED_PANEL,
  DialogContent,
  dialogVariants,
  DRAWER_LAYER,
  DRAWER_PANEL,
};
