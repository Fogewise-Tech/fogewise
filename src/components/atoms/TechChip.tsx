type Props = { label: string };

export function TechChip({ label }: Props) {
  return <span className="tech-chip">{label}</span>;
}
