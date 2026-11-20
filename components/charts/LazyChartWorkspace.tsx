"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import { workspaceSearch } from "@/components/charts/workspaceAddress";
import { WORKSPACE_FRAME } from "@/components/charts/workspaceStyles";
import type { Pair } from "@/lib/market/pairs";
import { pairPath } from "@/lib/site/seo";

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

const ChartWorkspace = dynamic(
  () => import("@/components/charts/ChartWorkspace"),
  { ssr: false, loading: WorkspaceLoading },
);

/** The chart, drawn in the browser only. Picking another coin goes to that
    coin's page, so the address, heading and text below always match it. */
export default function LazyChartWorkspace({ initialPair }: { initialPair: string }) {
  const router = useRouter();
  return (
    <ChartWorkspace
      initialPair={initialPair}
      onPickPair={(next: Pair) => router.push(`${pairPath(next)}${workspaceSearch()}`)}
    />
  );
}
