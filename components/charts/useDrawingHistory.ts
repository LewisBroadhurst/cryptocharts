"use client";

import { useCallback, useReducer } from "react";

import type { Drawing } from "@/lib/charts/drawings";

const DEPTH = 100;

type History = { now: Drawing[]; past: Drawing[][]; future: Drawing[][] };

type Action =
  | { type: "commit"; drawings: Drawing[] }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; drawings: Drawing[] };

function reduce(state: History, action: Action): History {
  switch (action.type) {
    case "commit":
      if (action.drawings === state.now) return state;
      return {
        now: action.drawings,
        past: [...state.past, state.now].slice(-DEPTH),
        future: [],
      };
    case "undo": {
      const before = state.past.at(-1);
      if (!before) return state;
      return {
        now: before,
        past: state.past.slice(0, -1),
        future: [state.now, ...state.future],
      };
    }
    case "redo": {
      const [after, ...rest] = state.future;
      if (!after) return state;
      return { now: after, past: [...state.past, state.now], future: rest };
    }
    case "reset":
      return { now: action.drawings, past: [], future: [] };
  }
}

export function useDrawingHistory(first: () => Drawing[]) {
  const [state, dispatch] = useReducer(reduce, undefined, () => ({
    now: first(),
    past: [],
    future: [],
  }));
  return {
    drawings: state.now,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    commit: useCallback(
      (drawings: Drawing[]) => dispatch({ type: "commit", drawings }),
      [],
    ),
    undo: useCallback(() => dispatch({ type: "undo" }), []),
    redo: useCallback(() => dispatch({ type: "redo" }), []),
    reset: useCallback(
      (drawings: Drawing[]) => dispatch({ type: "reset", drawings }),
      [],
    ),
  };
}
