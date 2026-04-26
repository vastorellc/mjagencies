import React from 'react'
import type { TeamGridProps } from './types.js'

export const TeamGrid: React.FC<TeamGridProps> = ({
  members,
  className = '',
}): React.ReactElement => (
  <section className={`mj-block mj-block--team-grid ${className}`}>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 'var(--mj-space-8)',
      }}
    >
      {members.map((member, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 'var(--mj-space-4)',
          }}
        >
          {member.imageUrl !== undefined ? (
            <img
              src={member.imageUrl}
              alt={member.imageAlt ?? member.name}
              style={{
                width: '120px',
                height: '120px',
                borderRadius: 'var(--mj-radius-full)',
                objectFit: 'cover',
              }}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              aria-hidden="true"
              style={{
                width: '120px',
                height: '120px',
                borderRadius: 'var(--mj-radius-full)',
                backgroundColor: 'var(--mj-color-brand-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--mj-font-heading)',
                fontSize: 'var(--mj-text-2xl)',
                color: 'var(--mj-color-bg)',
                fontWeight: 700,
              }}
            >
              {member.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h3
              style={{
                fontFamily: 'var(--mj-font-heading)',
                fontSize: 'var(--mj-text-lg)',
                color: 'var(--mj-color-text-primary)',
                margin: '0 0 var(--mj-space-1)',
              }}
            >
              {member.name}
            </h3>
            <p
              style={{
                fontFamily: 'var(--mj-font-body)',
                fontSize: 'var(--mj-text-sm)',
                color: 'var(--mj-color-brand-primary)',
                fontWeight: 600,
                margin: '0 0 var(--mj-space-2)',
              }}
            >
              {member.role}
            </p>
            {member.bio !== undefined && (
              <p
                style={{
                  fontFamily: 'var(--mj-font-body)',
                  fontSize: 'var(--mj-text-sm)',
                  color: 'var(--mj-color-text-secondary)',
                  margin: '0 0 var(--mj-space-3)',
                  lineHeight: 1.5,
                }}
              >
                {member.bio}
              </p>
            )}
            {member.linkedIn !== undefined && (
              <a
                href={member.linkedIn}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${member.name} on LinkedIn`}
                style={{
                  display: 'inline-block',
                  fontFamily: 'var(--mj-font-body)',
                  fontSize: 'var(--mj-text-xs)',
                  color: 'var(--mj-color-brand-primary)',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                LinkedIn &rarr;
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  </section>
)

export default TeamGrid
