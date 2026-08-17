import { PortfolioExperience } from "@/components/templates/PortfolioExperience";
import { getProjects } from "@/lib/getProjects";

export default async function HomePage() {
  const projects = await getProjects();
  return <PortfolioExperience projects={projects} />;
}
