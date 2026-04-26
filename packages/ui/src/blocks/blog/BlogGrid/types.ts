export interface BlogGridPost {
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: string;
  authorName?: string;
  imageUrl?: string;
  imageAlt?: string;
}

export interface BlogGridProps {
  posts: BlogGridPost[];
  columns?: 2 | 3;
  className?: string;
}
