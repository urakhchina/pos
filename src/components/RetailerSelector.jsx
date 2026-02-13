import React from 'react';
import { theme } from '../styles/theme';
import { Store } from 'lucide-react';

export default function RetailerSelector({ manifest, activeRetailer, setActiveRetailer }) {
  if (!manifest || !manifest.retailers) return null;

  const retailers = Object.entries(manifest.retailers);

  return (
    <div
      style={{
        background: theme.colors.cardBg,
        borderBottom: `1px solid ${theme.colors.border}`,
        padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.sm,
        overflowX: 'auto',
        whiteSpace: 'nowrap',
      }}
    >
      <Store size={16} style={{ color: theme.colors.textLight, flexShrink: 0 }} />
      <span
        style={{
          fontFamily: theme.fonts.body,
          fontSize: '0.8rem',
          color: theme.colors.textLight,
          marginRight: theme.spacing.xs,
          flexShrink: 0,
        }}
      >
        Retailer:
      </span>
      {retailers.map(([key, info]) => {
        const isActive = key === activeRetailer;
        return (
          <button
            key={key}
            onClick={() => setActiveRetailer(key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.spacing.xs,
              padding: `${theme.spacing.xs} ${theme.spacing.md}`,
              border: isActive ? `2px solid ${theme.colors.primary}` : `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.md,
              background: isActive ? theme.colors.primary : theme.colors.cardBg,
              color: isActive ? '#ffffff' : theme.colors.text,
              fontFamily: theme.fonts.body,
              fontSize: '0.85rem',
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              if (!isActive) {
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.background = '#f0fae0';
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.background = theme.colors.cardBg;
              }
            }}
          >
            {info.display_name || key.toUpperCase()}
            {info.product_count != null && (
              <span
                style={{
                  background: isActive ? 'rgba(255,255,255,0.3)' : theme.colors.backgroundAlt,
                  color: isActive ? '#ffffff' : theme.colors.textLight,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                }}
              >
                {info.product_count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
