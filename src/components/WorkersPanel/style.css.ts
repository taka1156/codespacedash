import { style } from '@vanilla-extract/css';

export const quotaWrap = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginBottom: 4,
});

export const quotaNote = style({
  fontSize: '0.72rem',
  color: 'var(--text-dim)',
});

export const warn = style({
  fontSize: '0.78rem',
  color: 'var(--red)',
});

export const emptyState = style({
  textAlign: 'center',
  padding: '32px 20px',
  color: 'var(--text-muted)',
  fontSize: '0.85rem',
  lineHeight: 1.7,
});

export const hash = style({
  fontFamily: 'var(--font-mono)',
});
