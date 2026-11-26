import { style } from '@vanilla-extract/css';

export const note = style({
  textAlign: 'center',
  padding: '28px 16px',
  color: 'var(--text-muted)',
  fontSize: '0.85rem',
  lineHeight: 1.7,
  border: '1px dashed var(--border)',
  borderRadius: 'var(--radius-sm)',
  overflowWrap: 'anywhere',
});

export const noteTitle = style({
  fontWeight: 600,
  color: 'var(--text)',
});

export const noteForbidden = style({
  borderColor: 'rgba(251, 191, 36, 0.35)',
});

export const noteError = style({
  borderColor: 'rgba(248, 113, 113, 0.35)',
});

export const detail = style({
  display: 'block',
  marginTop: 6,
  fontSize: '0.72rem',
  color: 'var(--text-dim)',
});
