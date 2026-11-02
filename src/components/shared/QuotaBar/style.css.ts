import { style } from '@vanilla-extract/css';

export const quotaRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const quotaHead = style({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: '2px 10px',
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
});

export const quotaValue = style({
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
});

export const quotaTrack = style({
  height: 6,
  borderRadius: 999,
  background: 'var(--bg-card)',
  overflow: 'hidden',
});

export const quotaFill = style({
  height: '100%',
  borderRadius: 999,
});

export const quotaOk = style({ background: 'var(--green)' });

export const quotaLow = style({ background: 'var(--red)' });
