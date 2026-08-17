"use client";

import { useExperienceStore } from "@/store/useExperienceStore";

export function SoundToggle() {
  const soundEnabled = useExperienceStore((state) => state.soundEnabled);
  const soundPlaying = useExperienceStore((state) => state.soundPlaying);
  const requestSoundStart = useExperienceStore((state) => state.requestSoundStart);
  const toggleSound = useExperienceStore((state) => state.toggleSound);
  const isWaitingForAutoplay = soundEnabled && !soundPlaying;

  return (
    <button
      type="button"
      className={`sound-toggle ${isWaitingForAutoplay ? "sound-toggle--pending" : ""}`}
      aria-label={soundEnabled ? "Turn sound off" : "Turn sound on"}
      aria-pressed={soundEnabled}
      onClick={isWaitingForAutoplay ? requestSoundStart : toggleSound}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="sound-toggle__icon"
      >
        <path d="M4 9.4v5.2h3.4L12 18.2V5.8L7.4 9.4H4Z" />
        {soundEnabled ? (
          <>
            <path d="M15.4 8.2a5.1 5.1 0 0 1 0 7.6" />
            <path d="M17.9 5.7a8.8 8.8 0 0 1 0 12.6" />
          </>
        ) : (
          <>
            <path d="m15.5 9 5 5" />
            <path d="m20.5 9-5 5" />
          </>
        )}
      </svg>
    </button>
  );
}
