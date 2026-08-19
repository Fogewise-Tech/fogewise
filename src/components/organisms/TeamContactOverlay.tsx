"use client";

import { useExperienceStore } from "@/store/useExperienceStore";

type Props = {
  projectCount: number;
};

const TEAM_EMAIL = "hello@fogewise.com";

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function TeamContactOverlay({ projectCount }: Props) {
  const scrollProgress = useExperienceStore((state) => state.scrollProgress);

  const lastProjectCheckpoint =
    projectCount > 0 ? (projectCount - 1) / projectCount : 0;

  const finalSegment = Math.max(0.0001, 1 - lastProjectCheckpoint);

  /**
   * One continuous depth move:
   * - Contact copy leads the movement.
   * - Milky Way starts shortly after, while the copy is STILL approaching.
   * - Copy reaches final framing first; Milky Way continues behind it.
   */
  const textTravelStart = lastProjectCheckpoint + finalSegment * 0.72;

  const textTravelEnd = lastProjectCheckpoint + finalSegment * 0.995;

  const textProgress = clamp01(
    (scrollProgress - textTravelStart) /
      Math.max(0.0001, textTravelEnd - textTravelStart),
  );

  const approach = smoothstep(textProgress);

  const textScale = 0.075 + approach * 0.925;

  const strength = smoothstep((textProgress - 0.03) / 0.68);

  const depthLift = (1 - approach) * 8;
  const blur = (1 - approach) * 1.7;

  return (
    <section
      className="team-contact"
      aria-hidden={strength < 0.02}
      style={{
        opacity: strength,
        pointerEvents: "none",
      }}
    >
      <div
        className="team-contact__content"
        style={{
          transform: `translate3d(0, ${depthLift}px, 0) scale(${textScale})`,
          filter: `blur(${blur}px)`,
        }}
      >
        <h2 className="team-contact__headline">
          <span>WITH US IT HAPPENS.</span>

          <a
            className="team-contact__email interactive-copy"
            href={`mailto:${TEAM_EMAIL}`}
          >
            {TEAM_EMAIL.toUpperCase()}
          </a>
        </h2>
      </div>
    </section>
  );
}
