"use client";

import { useEffect, useRef } from "react";
import { useExperienceStore } from "@/store/useExperienceStore";

const BASE_VOLUME = 0.2;
const SCROLL_VOLUME_BOOST = 0.13;
const MAX_PLAYBACK_RATE_BOOST = 0.035;

export function SpaceSoundscape() {
  const soundEnabled = useExperienceStore((state) => state.soundEnabled);
  const soundStartRequest = useExperienceStore(
    (state) => state.soundStartRequest,
  );
  const setSoundPlaying = useExperienceStore((state) => state.setSoundPlaying);
  const soundEnabledRef = useRef(soundEnabled);
  const setSoundPlayingRef = useRef(setSoundPlaying);
  const startedRef = useRef(false);
  const scrollEnergyRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    const audio = audioRef.current;
    if (!audio) return;
    if (!soundEnabled) {
      audio.pause();
      audio.volume = 0;
      startedRef.current = false;
      setSoundPlaying(false);
      return;
    }

    if (startedRef.current || soundStartRequest > 0) {
      startedRef.current = true;

      audio.volume = BASE_VOLUME;

      void audio
        .play()
        .then(() => {
          setSoundPlaying(true);
        })
        .catch(() => {
          startedRef.current = false;
          setSoundPlaying(false);
        });
    }
  }, [soundEnabled, soundStartRequest, setSoundPlaying]);

  useEffect(() => {
    setSoundPlayingRef.current = setSoundPlaying;
  }, [setSoundPlaying]);

  useEffect(() => {
    const audio = new Audio("/audio/space-sound.mp3");
    audioRef.current = audio;
    audio.autoplay = true;
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = BASE_VOLUME;
    audio.playbackRate = 1;

    const start = () => {
      if (!soundEnabledRef.current) return;
      if (startedRef.current) return;
      startedRef.current = true;
      audio.volume = BASE_VOLUME;

      void audio
        .play()
        .then(() => {
          setSoundPlayingRef.current(true);
        })
        .catch(() => {
          startedRef.current = false;
          setSoundPlayingRef.current(false);
        });
    };

    start();

    const addScrollEnergy = (amount: number) => {
      start();
      scrollEnergyRef.current = Math.min(
        1,
        scrollEnergyRef.current + Math.max(0.08, amount),
      );
    };

    const onWheel = (event: WheelEvent) => {
      addScrollEnergy(Math.min(0.7, Math.abs(event.deltaY) / 900));
    };

    const onTouchStart = () => {
      start();
    };

    const onTouchMove = () => {
      addScrollEnergy(0.16);
    };

    const onPointerDown = () => {
      start();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "PageDown" ||
        event.key === "PageUp" ||
        event.key === " "
      ) {
        addScrollEnergy(0.22);
      } else {
        start();
      }
    };

    const tick = (now: number) => {
      const deltaSeconds = lastFrameRef.current
        ? Math.min(0.05, (now - lastFrameRef.current) / 1000)
        : 1 / 60;
      lastFrameRef.current = now;
      scrollEnergyRef.current *= Math.exp(-2.8 * deltaSeconds);
      const energy = scrollEnergyRef.current;

      if (startedRef.current && !audio.paused && soundEnabledRef.current) {
        const targetVolume = BASE_VOLUME + SCROLL_VOLUME_BOOST * energy;
        const volumeEase = 1 - Math.exp(-4.8 * deltaSeconds);
        audio.volume += (targetVolume - audio.volume) * volumeEase;
        const targetRate = 1 + MAX_PLAYBACK_RATE_BOOST * energy;
        const rateEase = 1 - Math.exp(-4.2 * deltaSeconds);
        audio.playbackRate += (targetRate - audio.playbackRate) * rateEase;
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    const onVisibilityChange = () => {
      if (!document.hidden && soundEnabledRef.current) {
        if (audio.paused) {
          void audio
            .play()
            .then(() => {
              startedRef.current = true;
              setSoundPlayingRef.current(true);
            })
            .catch(() => {
              setSoundPlayingRef.current(false);
            });
        }
      }
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibilityChange);
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }

      audio.pause();
      audio.src = "";
      audioRef.current = null;
      setSoundPlayingRef.current(false);
    };
  }, []);

  return null;
}
