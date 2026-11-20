import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const popoverVariants = cva(
  "rounded-lg border border-border-strong bg-popover text-left shadow-popover",
  {
    variants: {
      padding: { none: "", sm: "p-2", md: "p-3" },
    },
    defaultVariants: { padding: "sm" },
  },
);

function PopoverContent({
  className,
  padding,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof popoverVariants>) {
  return (
    <div
      data-slot="popover-content"
      className={cn(popoverVariants({ padding }), className)}
      {...props}
    />
  );
}

export { PopoverContent, popoverVariants };
