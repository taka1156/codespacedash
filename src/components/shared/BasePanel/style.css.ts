import { style } from '@vanilla-extract/css';

export const panel = style({
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: 24,
  transition: 'border-color 0.2s',
  selectors: {
    '&:hover': {
      borderColor: 'var(--border-bright)',
    },
  },
});

export const panelHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 20,
});

export const panelTitle = style({
  fontFamily: 'var(--font-mono)',
  fontSize: '0.95rem',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 4,
});

export const panelSub = style({
  fontSize: '0.78rem',
  color: 'var(--text-muted)',
});

export const icon = style({
  fontSize: '0.9em',
  opacity: 0.7,
});

export const emptyState = style({
  textAlign: 'center',
  padding: '40px 20px',
  color: 'var(--text-muted)',
  fontSize: '0.85rem',
  lineHeight: 1.7,
});

export const statBadge = style({
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
  fontWeight: 600,
  padding: '4px 12px',
  borderRadius: 20,
  background: 'var(--bg-card)',
  border: '1px solid var(--border-bright)',
  color: 'var(--text-muted)',
});
