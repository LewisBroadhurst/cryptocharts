"use client";

import dynamic from "next/dynamic";

import { WORKSPACE_FRAME } from "@/components/charts/workspaceStyles";

function WorkspaceLoading() {
  return (
    <div className={WORKSPACE_FRAME}>
      <div className="h-10 border-b border-border" />
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading chart…
      </div>
    </div>
  );
}

const LazyChartWorkspace = dynamic(
  () => import("@/components/charts/ChartWorkspace"),
  { ssr: false, loading: WorkspaceLoading },
);

export default LazyChartWorkspace;
