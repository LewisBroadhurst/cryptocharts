import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { fieldVariants, type FieldProps } from "@/components/ui/field";

function Input({
  className,
  variant,
  ...props
}: ComponentProps<"input"> & FieldProps) {
  return (
    <input
      data-slot="input"
      className={cn(fieldVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Input };
