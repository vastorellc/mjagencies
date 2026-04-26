export interface AuthorSocialLink {
  platform: string;
  href: string;
}

export interface AuthorBioProps {
  name: string;
  bio: string;
  role?: string;
  imageUrl?: string;
  imageAlt?: string;
  socialLinks?: AuthorSocialLink[];
  className?: string;
}
