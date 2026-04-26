export interface BlogFeaturedPost {
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: string;
  authorName: string;
  imageUrl: string;
  imageAlt: string;
  blurHash?: string;
}

export interface BlogFeaturedProps {
  post: BlogFeaturedPost;
  className?: string;
}
