import { ProjectCounter } from "@/components/atoms/ProjectCounter";

type Props = {
  progress: number;
  activeIndex: number;
  total: number;
};

export function JourneyProgress({ progress, activeIndex, total }: Props) {
  return (
    <div className="journey-progress">
      <div className="journey-progress__meta">
        <ProjectCounter activeIndex={activeIndex} total={total} />
        <span>{Math.round(progress * 100)}%</span>
      </div>
      <div className="journey-progress__track">
        <div
          className="journey-progress__fill"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </div>
  );
}
