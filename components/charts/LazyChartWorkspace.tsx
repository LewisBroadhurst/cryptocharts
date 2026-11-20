"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import { workspaceSearch } from "@/components/charts/workspaceAddress";
import { WORKSPACE_FRAME } from "@/components/charts/workspaceStyles";
import type { Pair } from "@/lib/market/pairs";
import {
  chartPagePath,
  chartPreset,
  samePageFor,
  type ChartPage,
} from "@/lib/site/pages";

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
    coin's page, or to its version of this indicator or backtest page where it
    has one, so the address, heading and text below always match it. */
export default function LazyChartWorkspace({ page }: { page: ChartPage }) {
  const router = useRouter();
  return (
    <ChartWorkspace
      pair={page.pair.id}
      preset={chartPreset(page)}
      // The chart is where the reader is: stay there rather than scroll to the
      // new page's text.
      onPickPair={(next: Pair) =>
        router.push(`${chartPagePath(samePageFor(page, next))}${workspaceSearch()}`, {
          scroll: false,
        })
      }
    />
  );
}
