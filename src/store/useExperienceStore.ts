"use client";

import { create } from "zustand";

type ExperienceState = {
  scrollProgress: number;
  activeIndex: number;
  focusStrength: number;
  selectedProjectId: string | null;
  soundEnabled: boolean;
  soundPlaying: boolean;
  soundStartRequest: number;
  setJourneyState: (progress: number, activeIndex: number, focusStrength: number) => void;
  setSoundPlaying: (soundPlaying: boolean) => void;
  requestSoundStart: () => void;
  toggleSound: () => void;
  openProject: (projectId: string) => void;
  closeProject: () => void;
};

export const useExperienceStore = create<ExperienceState>((set) => ({
  scrollProgress: 0,
  activeIndex: 0,
  focusStrength: 0,
  selectedProjectId: null,
  soundEnabled: true,
  soundPlaying: false,
  soundStartRequest: 0,
  setJourneyState: (scrollProgress, activeIndex, focusStrength) =>
    set({ scrollProgress, activeIndex, focusStrength }),
  setSoundPlaying: (soundPlaying) => set({ soundPlaying }),
  requestSoundStart: () =>
    set((state) => ({
      soundEnabled: true,
      soundStartRequest: state.soundStartRequest + 1,
    })),
  toggleSound: () =>
    set((state) => ({
      soundEnabled: !state.soundEnabled,
      soundPlaying: state.soundEnabled ? false : state.soundPlaying,
    })),
  openProject: (selectedProjectId) => set({ selectedProjectId }),
  closeProject: () => set({ selectedProjectId: null }),
}));
