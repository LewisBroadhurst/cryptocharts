"use client";

import { useEffect, useState } from "react";

import {
  applySaved,
  fetchAccount,
  onSignIn,
  sameWorkspace,
  saveWorkspace,
  signInHref,
  snapshot,
  STRATDECK,
} from "@/lib/account/workspace-sync";

/** How often this browser's changes are checked for and saved. */
const SAVE_EVERY_MS = 4_000;
/** Set once saved work has been brought in, so the reload it needs happens once. */
const APPLIED_KEY = "cryptocharts-sync-applied";

type State = { kind: "unknown" } | { kind: "signed-out" } | { kind: "signed-in"; name: string | null };

/**
 * Sign in with StratDeck, and once signed in keep this browser's layouts,
 * drawings and scripts saved to the account. Shows nothing if StratDeck can't
 * be reached: the charts work the same without it.
 */
export default function AccountBadge() {
  const [state, setState] = useState<State>({ kind: "unknown" });

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    void (async () => {
      const account = await fetchAccount();
      if (!live || !account) return;
      if (!account.signedIn) {
        setState({ kind: "signed-out" });
        return;
      }
      let local: Record<string, string>;
      try {
        local = snapshot(localStorage);
      } catch {
        return;
      }
      const next = onSignIn(local, account.data);
      if (next === "download" && account.data) {
        // Saved work replaces this browser's, once: the chart reads its
        // settings at start, so it starts again with them.
        const stamp = account.updatedAt ?? "saved";
        if (sessionStorage.getItem(APPLIED_KEY) !== stamp) {
          sessionStorage.setItem(APPLIED_KEY, stamp);
          applySaved(localStorage, account.data);
          location.reload();
          return;
        }
      }
      if (next === "upload") await saveWorkspace(local);
      if (!live) return;
      setState({ kind: "signed-in", name: account.name });
      let sent = snapshot(localStorage);
      timer = setInterval(() => {
        const now = snapshot(localStorage);
        if (sameWorkspace(now, sent)) return;
        sent = now;
        void saveWorkspace(now);
      }, SAVE_EVERY_MS);
    })();
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  if (state.kind === "unknown") return null;
  if (state.kind === "signed-out")
    return (
      <a
        href={signInHref("")}
        onClick={(event) => {
          event.currentTarget.href = signInHref(window.location.search);
        }}
        className="text-sm text-subtle-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Sign in with StratDeck to save your charts
      </a>
    );
  return (
    <a
      href={`${STRATDECK}/account`}
      className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
    >
      Saved to {state.name ? `${state.name}'s` : "your"} StratDeck account
    </a>
  );
}
