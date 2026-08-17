"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Project } from "@/types/project";
import { CustomSparkleCursor } from "@/components/atoms/CustomSparkleCursor";
import { SpaceSoundscape } from "@/components/atoms/SpaceSoundscape";
import { ExperienceCanvas } from "@/components/organisms/ExperienceCanvas";
import { PortfolioHud } from "@/components/organisms/PortfolioHud";
import { ProjectDetailOverlay } from "@/components/organisms/ProjectDetailOverlay";
import { getInfiniteJourneyState } from "@/lib/journey";
import { useExperienceStore } from "@/store/useExperienceStore";

type Props = { projects: Project[] };

gsap.registerPlugin(ScrollTrigger);

export function PortfolioExperience({ projects }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const cycleRef = useRef(0);
  const recyclingRef = useRef(false);
  const setJourneyState = useExperienceStore((state) => state.setJourneyState);

  const baseScrollHeightVh = Math.max(650, (projects.length + 1) * 190);

  // One original journey occupies 60% of the native scroll range.
  // That lets us recycle well before the browser reaches the page bottom,
  // while preserving the exact scroll distance/speed of the original source.
  const loopStart = 0.2;
  const loopEnd = 0.8;
  const loopSpan = loopEnd - loopStart;
  const firstCycleEnd = loopSpan;
  const scrollHeightVh = 100 + (baseScrollHeightVh - 100) / loopSpan;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    // A hard reload must always look exactly like the original first frame.
    cycleRef.current = 0;
    recyclingRef.current = true;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const context = gsap.context(() => {
      const commitJourney = (localProgress: number) => {
        const local = Math.min(1, Math.max(0, localProgress));
        const virtualProgress = cycleRef.current + local;
        const journey = getInfiniteJourneyState(virtualProgress, projects.length);
        setJourneyState(
          virtualProgress,
          journey.activeIndex,
          journey.focusStrength,
        );
      };

      const recycleScroll = (self: ScrollTrigger, normalized: number) => {
        const top = self.start + (self.end - self.start) * normalized;
        recyclingRef.current = true;
        window.scrollTo({ top, left: 0, behavior: "auto" });

        requestAnimationFrame(() => {
          recyclingRef.current = false;
          ScrollTrigger.update();
        });
      };

      const trigger = ScrollTrigger.create({
        trigger: root,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          if (recyclingRef.current) return;

          // First pass begins at the real top of the document.
          if (cycleRef.current === 0) {
            if (self.direction > 0 && self.progress >= firstCycleEnd) {
              // Preserve wheel/touch overshoot instead of snapping exactly to
              // progress 0 of the next virtual cycle. This removes the tiny
              // one-frame pause that could be felt at the recycle point.
              const overflow = Math.max(0, self.progress - firstCycleEnd);
              const nextLocal = Math.min(0.12, overflow / loopSpan);
              cycleRef.current = 1;
              commitJourney(nextLocal);
              recycleScroll(self, loopStart + nextLocal * loopSpan);
              return;
            }

            commitJourney(self.progress / firstCycleEnd);
            return;
          }

          // Every following pass stays inside the middle of the document.
          // The native scrollbar therefore never arrives at its bottom edge.
          if (self.direction > 0 && self.progress >= loopEnd) {
            const overflow = Math.max(0, self.progress - loopEnd);
            const nextLocal = Math.min(0.12, overflow / loopSpan);
            cycleRef.current += 1;
            commitJourney(nextLocal);
            recycleScroll(self, loopStart + nextLocal * loopSpan);
            return;
          }

          if (self.direction < 0 && self.progress <= loopStart) {
            const underflow = Math.max(0, loopStart - self.progress);
            const previousLocal = Math.max(0.88, 1 - underflow / loopSpan);
            cycleRef.current = Math.max(0, cycleRef.current - 1);
            commitJourney(previousLocal);
            recycleScroll(
              self,
              cycleRef.current === 0
                ? firstCycleEnd * previousLocal
                : loopStart + previousLocal * loopSpan,
            );
            return;
          }

          commitJourney((self.progress - loopStart) / loopSpan);
        },
      });

      commitJourney(0);

      // Chrome can try to restore the old scroll after hydration. Re-assert
      // the top position for the first paint only; later loop recycling is
      // handled exclusively by ScrollTrigger above.
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        requestAnimationFrame(() => {
          recyclingRef.current = false;
          ScrollTrigger.refresh();
          ScrollTrigger.update();
        });
      });
    }, root);

    return () => {
      context.revert();
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, [firstCycleEnd, loopEnd, loopSpan, loopStart, projects.length, setJourneyState]);

  return (
    <main
      ref={rootRef}
      className="portfolio-shell"
      style={{ minHeight: `${scrollHeightVh}vh` }}
    >
      <SpaceSoundscape />
      <CustomSparkleCursor />
      <div className="canvas-shell">
        <ExperienceCanvas projects={projects} />
      </div>
      <PortfolioHud projects={projects} />
      <ProjectDetailOverlay projects={projects} />
    </main>
  );
}
