import { cva, type VariantProps } from "class-variance-authority";

export const fieldVariants = cva(
  "rounded-md border text-accent-foreground placeholder:text-faint-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted",
  {
    variants: {
      variant: {
        control:
          "border-input bg-surface px-2.5 py-1 text-xs focus:border-border-strong",
        form: "border-border-strong bg-background px-2.5 py-1.5 text-sm",
      },
    },
    defaultVariants: { variant: "form" },
  },
);

export type FieldProps = VariantProps<typeof fieldVariants>;
