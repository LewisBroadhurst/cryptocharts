import { cardVariants } from "@/components/ui/card";

export * from "@/components/base/panelText";

export const PANEL = cardVariants({
  surface: "solid",
  radius: "lg",
  padding: "none",
});

export const PANEL_BODY = cardVariants({
  surface: "solid",
  radius: "lg",
  padding: "lg",
});

export const EMPTY_STATE = `${PANEL} px-4 py-8 text-center text-sm text-muted-foreground`;
