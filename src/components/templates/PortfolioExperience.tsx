"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Project } from "@/types/project";
import { SpaceSoundscape } from "@/components/atoms/SpaceSoundscape";
import { GlitterWarpBackground } from "@/components/atoms/GlitterWarpBackground";
import TwinGalaxyRings from "@/components/atoms/TwinGalaxyRings";
import { ExperienceCanvas } from "@/components/organisms/ExperienceCanvas";
import { PortfolioHud } from "@/components/organisms/PortfolioHud";
import { TeamContactOverlay } from "@/components/organisms/TeamContactOverlay";
import { getJourneyState } from "@/lib/journey";
import { useExperienceStore } from "@/store/useExperienceStore";
import { useMobilePerformanceMode } from "@/hooks/useMobilePerformanceMode";

type Props = { projects: Project[] };

gsap.registerPlugin(ScrollTrigger);

const SCROLL_RESPONSE = 7.2;
const MAX_FRAME_DELTA = 1 / 20;

export function PortfolioExperience({ projects }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const setJourneyState = useExperienceStore((state) => state.setJourneyState);
  const mobilePerformanceMode = useMobilePerformanceMode();

  const scrollHeightVh = Math.max(760, (projects.length + 2) * 190);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    let targetProgress = 0;
    let renderedProgress = 0;
    let lastTime = performance.now();
    let rafId = 0;
    let trigger: ScrollTrigger | null = null;
    let lastCommittedProgress = -1;

    const commitJourney = (progress: number) => {
      const normalized = Math.min(1, Math.max(0, progress));
      const journey = getJourneyState(normalized, projects.length);

      setJourneyState(
        normalized,
        journey.activeIndex,
        journey.focusStrength,
      );
    };

    const animate = (now: number) => {
      const delta = Math.min(MAX_FRAME_DELTA, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;

      const alpha = 1 - Math.exp(-SCROLL_RESPONSE * delta);
      renderedProgress += (targetProgress - renderedProgress) * alpha;

      if (Math.abs(targetProgress - renderedProgress) < 0.00001) {
        renderedProgress = targetProgress;
      }

      if (Math.abs(renderedProgress - lastCommittedProgress) > 0.00001) {
        commitJourney(renderedProgress);
        lastCommittedProgress = renderedProgress;
      }
      rafId = requestAnimationFrame(animate);
    };

    const context = gsap.context(() => {
      trigger = ScrollTrigger.create({
        trigger: root,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          targetProgress = Math.min(1, Math.max(0, self.progress));
        },
      });

      targetProgress = 0;
      renderedProgress = 0;
      commitJourney(0);
      rafId = requestAnimationFrame(animate);

      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });

        requestAnimationFrame(() => {
          ScrollTrigger.refresh();
          trigger?.update();
        });
      });
    }, root);

    return () => {
      cancelAnimationFrame(rafId);
      trigger?.kill();
      context.revert();
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, [projects.length, setJourneyState]);

  return (
    <main
      ref={rootRef}
      className="portfolio-shell"
      style={{ minHeight: `${scrollHeightVh}vh` }}
    >
      <SpaceSoundscape />
      <GlitterWarpBackground mobileMode={mobilePerformanceMode} />

      <div className="canvas-shell">
        <div className="twin-galaxy-layer">
          <TwinGalaxyRings
            projectCount={projects.length}
            mobileMode={mobilePerformanceMode}
          />
        </div>
        <div className="experience-canvas-layer">
          <ExperienceCanvas projects={projects} mobileMode={mobilePerformanceMode} />
        </div>
      </div>

      <PortfolioHud projects={projects} />
      <TeamContactOverlay projectCount={projects.length} />
    </main>
  );
}
