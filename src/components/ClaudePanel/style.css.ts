import { style, styleVariants } from '@vanilla-extract/css';

export const note = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  background: 'var(--claude-dim)',
  border: '1px solid rgba(217, 119, 87, 0.25)',
  borderRadius: 'var(--radius-sm)',
  padding: '14px 16px',
  fontSize: '0.8rem',
  color: 'var(--text-muted)',
  lineHeight: 1.6,
});

export const noteIcon = style({
  fontSize: '1.1rem',
  flexShrink: 0,
});

export const tiles = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 10,
  marginBottom: 18,
  '@media': {
    '(max-width: 420px)': {
      gap: 6,
    },
  },
});

export const tile = style({
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 0,
});

export const tileLabel = style({
  fontSize: '0.68rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  whiteSpace: 'nowrap',
});

export const tileValue = style({
  fontFamily: 'var(--font-mono)',
  fontSize: '1.15rem',
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
});

export const tileSub = style({
  fontSize: '0.7rem',
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-mono)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const accentClaude = style({ color: 'var(--claude)' });
export const accentGreen = style({ color: 'var(--green)' });

export const sectionTitle = style({
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 8,
  fontFamily: 'var(--font-mono)',
});

export const section = style({
  marginBottom: 18,
});

export const stackBar = style({
  display: 'flex',
  height: 10,
  borderRadius: 999,
  overflow: 'hidden',
  background: 'var(--bg-card)',
  gap: 2,
});

export const legendGrid = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '6px 16px',
  marginTop: 10,
});

export const legendItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  minWidth: 0,
});

export const legendValue = style({
  marginLeft: 'auto',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text)',
  fontVariantNumeric: 'tabular-nums',
});

export const dot = style({
  width: 8,
  height: 8,
  borderRadius: 2,
  flexShrink: 0,
});

export const modelList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const modelRow = style({
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: '4px 12px',
  alignItems: 'baseline',
});

export const modelName = style({
  fontFamily: 'var(--font-mono)',
  fontSize: '0.8rem',
  color: 'var(--text)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const modelCost = style({
  fontFamily: 'var(--font-mono)',
  fontSize: '0.8rem',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--claude)',
});

export const modelMeta = style({
  gridColumn: '1 / -1',
  display: 'flex',
  gap: 12,
  fontFamily: 'var(--font-mono)',
  fontSize: '0.7rem',
  color: 'var(--text-muted)',
  fontVariantNumeric: 'tabular-nums',
});

export const shareTrack = style({
  gridColumn: '1 / -1',
  height: 4,
  borderRadius: 999,
  background: 'var(--bg-card)',
  overflow: 'hidden',
});

export const shareFill = style({
  height: '100%',
  borderRadius: 999,
  background: 'var(--claude)',
});

export const chartWrap = style({
  borderTop: '1px solid var(--border)',
  paddingTop: 16,
});

export const tokenColor = styleVariants({
  input: { background: '#d97757' },
  cacheWrite: { background: '#e8b04a' },
  cacheRead: { background: '#6b8f71' },
  output: { background: '#c9a7f5' },
});

export const linkRow = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '8px 14px',
});

export const linkButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 14px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--claude-dim)',
  border: '1px solid rgba(217, 119, 87, 0.4)',
  color: 'var(--claude)',
  fontSize: '0.82rem',
  fontWeight: 500,
  textDecoration: 'none',
  transition: 'background 0.15s',
  selectors: {
    '&:hover': { background: 'rgba(217, 119, 87, 0.25)' },
    '&:focus-visible': {
      outline: '2px solid var(--claude)',
      outlineOffset: 2,
    },
  },
});

export const linkSub = style({
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
});
