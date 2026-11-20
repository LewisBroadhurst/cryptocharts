"use client";

import { useState } from "react";

import { searchPairs, type Pair } from "@/lib/market/pairs";
import ChartPopover, { PopoverOption } from "@/components/charts/ChartPopover";

export default function PairPicker({
  current,
  onPick,
  buttonClassName,
}: {
  current: Pair;
  onPick: (pair: Pair) => void;
  buttonClassName: string;
}) {
  const [query, setQuery] = useState("");
  const found = searchPairs(query);

  return (
    <ChartPopover
      label="Pair"
      className="shrink-0"
      panelClassName="w-64 p-1.5"
      trigger={(props) => (
        <button
          {...props}
          aria-label={`Pair: ${current.id}. Change pair`}
          className={buttonClassName}
          onClick={() => {
            setQuery("");
            props.onClick();
          }}
        >
          <span className="text-sm font-semibold text-foreground">{current.base}</span>
          <span className="text-subtle-foreground">/USD</span>
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-1">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && found[0]) {
                onPick(found[0]);
                close();
              }
            }}
            placeholder="Search coins"
            aria-label="Search coins"
            className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted"
          />
          <div className="max-h-72 overflow-y-auto">
            {found.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">No coin matches.</p>
            ) : (
              found.map((pair) => (
                <PopoverOption
                  key={pair.id}
                  active={pair.id === current.id}
                  onPick={() => {
                    onPick(pair);
                    close();
                  }}
                >
                  <span className="w-12 font-semibold">{pair.base}</span>
                  <span className="text-subtle-foreground">{pair.name}</span>
                </PopoverOption>
              ))
            )}
          </div>
        </div>
      )}
    </ChartPopover>
  );
}
