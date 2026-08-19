"use client";

import { useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 820px), (hover: none), (pointer: coarse)";

function getSnapshot() {
  if (typeof window === "undefined") return true;
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerSnapshot() {
  // Render the cheaper variant during SSR/hydration. Desktop upgrades immediately
  // after hydration; mobile never has to build the expensive desktop scene first.
  return true;
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", onStoreChange);
  window.addEventListener("resize", onStoreChange, { passive: true });

  return () => {
    media.removeEventListener("change", onStoreChange);
    window.removeEventListener("resize", onStoreChange);
  };
}

export function useMobilePerformanceMode() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
