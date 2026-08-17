type Props = {
  activeIndex: number;
  total: number;
};

export function ProjectCounter({ activeIndex, total }: Props) {
  return (
    <span className="project-counter">
      {String(activeIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
    </span>
  );
}
