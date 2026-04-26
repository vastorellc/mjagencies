import React from 'react';
import type { AuthorBioProps } from './types.js';

export function AuthorBio({
  name,
  bio,
  role,
  imageUrl,
  imageAlt,
  socialLinks,
  className,
}: AuthorBioProps): React.ReactElement {
  const cardStyle: React.CSSProperties = {
    display: 'flex',
    gap: 'var(--mj-space-5)',
    padding: 'var(--mj-space-6)',
    background: 'var(--mj-color-surface-subtle)',
    borderRadius: 'var(--mj-radius-md)',
    borderLeft: '4px solid var(--mj-color-brand-primary)',
    alignItems: 'flex-start',
  };

  const avatarStyle: React.CSSProperties = {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
  };

  const avatarFallbackStyle: React.CSSProperties = {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'var(--mj-color-brand-primary)',
    color: 'var(--mj-color-brand-primary-contrast)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--mj-text-2xl)',
    fontWeight: 'var(--mj-font-bold)' as React.CSSProperties['fontWeight'],
    flexShrink: 0,
    userSelect: 'none',
  };

  const nameStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-lg)',
    fontWeight: 'var(--mj-font-semibold)' as React.CSSProperties['fontWeight'],
    color: 'var(--mj-color-text-primary)',
    margin: '0 0 var(--mj-space-1) 0',
  };

  const roleStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-sm)',
    color: 'var(--mj-color-text-muted)',
    margin: '0 0 var(--mj-space-3) 0',
  };

  const bioStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-sm)',
    color: 'var(--mj-color-text-secondary)',
    margin: '0 0 var(--mj-space-3) 0',
    lineHeight: 'var(--mj-leading-relaxed)',
  };

  const socialListStyle: React.CSSProperties = {
    display: 'flex',
    gap: 'var(--mj-space-3)',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  };

  const socialLinkStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-sm)',
    color: 'var(--mj-color-brand-primary)',
    textDecoration: 'none',
    fontWeight: 'var(--mj-font-medium)' as React.CSSProperties['fontWeight'],
  };

  return (
    <aside className={className} aria-label={`About ${name}`} style={cardStyle}>
      {imageUrl ? (
        <img src={imageUrl} alt={imageAlt ?? name} style={avatarStyle} loading="lazy" />
      ) : (
        <div style={avatarFallbackStyle} aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div>
        <h3 style={nameStyle}>{name}</h3>
        {role && <p style={roleStyle}>{role}</p>}
        <p style={bioStyle}>{bio}</p>
        {socialLinks && socialLinks.length > 0 && (
          <ul style={socialListStyle}>
            {socialLinks.map((link) => (
              <li key={link.platform}>
                <a
                  href={link.href}
                  style={socialLinkStyle}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {link.platform}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
