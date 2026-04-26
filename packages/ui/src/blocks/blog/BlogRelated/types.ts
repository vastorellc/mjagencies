export interface BlogRelatedPost {
  title: string;
  slug: string;
  excerpt: string;
  imageUrl?: string;
  imageAlt?: string;
}

export interface BlogRelatedProps {
  posts: BlogRelatedPost[];
  headline?: string;
  className?: string;
}
