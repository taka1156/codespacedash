import { style } from '@vanilla-extract/css';

export const list = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});

export const footNote = style({
  marginTop: 20,
  fontSize: '0.72rem',
  lineHeight: 1.7,
  color: 'var(--text-dim)',
});
