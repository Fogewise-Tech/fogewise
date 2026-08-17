export type Project = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  technologies: string[];
  year: number;

  coverImage?: string;
  model3d?: string;
  accent?: string;

  githubUrl?: string;
  websiteUrl?: string;
  caseStudyUrl?: string;

  challenge?: string;
  solution?: string;
  result?: string;
  highlights?: string[];

  featured: boolean;
  published: boolean;
  sortOrder: number;
};
