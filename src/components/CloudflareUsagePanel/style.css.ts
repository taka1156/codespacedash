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

export const errorList = style({
  margin: '16px 0 0',
  padding: '10px 12px 10px 26px',
  border: '1px dashed rgba(248, 113, 113, 0.35)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.72rem',
  lineHeight: 1.6,
  color: 'var(--text-muted)',
  overflowWrap: 'anywhere',
});
