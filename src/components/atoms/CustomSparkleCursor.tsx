"use client";

import { useEffect, useRef } from "react";

export function CustomSparkleCursor() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Keep the sparkle visible immediately, even before the first pointer move.
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight / 2;
    root.style.transform = `translate3d(${startX}px, ${startY}px, 0) translate(-50%, -50%)`;

    const handleMove = (event: PointerEvent) => {
      root.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;
    };

    window.addEventListener("pointermove", handleMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handleMove);
    };
  }, []);

  return (
    <div ref={rootRef} aria-hidden="true" className="sparkle-cursor">
      <svg viewBox="0 0 100 100" role="presentation">
        <defs>
          <radialGradient id="pointer-sparkle-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="30%" stopColor="#ffffff" stopOpacity="0.98" />
            <stop offset="58%" stopColor="#f5f8ff" stopOpacity="0.68" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pointer-ray-vertical" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="43%" stopColor="#ffffff" stopOpacity="0.34" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="57%" stopColor="#ffffff" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pointer-ray-horizontal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="43%" stopColor="#ffffff" stopOpacity="0.34" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="57%" stopColor="#ffffff" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Long vertical ray. */}
        <rect
          x="48.9"
          y="2"
          width="2.2"
          height="96"
          rx="1.1"
          fill="url(#pointer-ray-vertical)"
        />
        <rect
          x="49.65"
          y="8"
          width="0.7"
          height="84"
          rx="0.35"
          fill="#ffffff"
          opacity="0.76"
        />

        {/* Slightly shorter horizontal ray. */}
        <rect
          x="7"
          y="48.9"
          width="86"
          height="2.2"
          rx="1.1"
          fill="url(#pointer-ray-horizontal)"
        />
        <rect
          x="13"
          y="49.65"
          width="74"
          height="0.7"
          rx="0.35"
          fill="#ffffff"
          opacity="0.72"
        />

        {/* Bright center. */}
        <circle cx="50" cy="50" r="4.6" fill="url(#pointer-sparkle-core)" />
        <circle cx="50" cy="50" r="1.9" fill="#ffffff" />
      </svg>
    </div>
  );
}
