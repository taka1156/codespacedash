import { style } from '@vanilla-extract/css';

export const tabs = style({
  display: 'flex',
  gap: 4,
  padding: 3,
  marginBottom: 18,
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-sm)',
});

export const tab = style({
  flex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  minWidth: 0,
  padding: '6px 10px',
  whiteSpace: 'nowrap',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  selectors: {
    '&[aria-selected="true"]': {
      background: 'var(--bg-hover)',
      color: 'var(--text)',
    },
    '&:focus-visible': {
      outline: '2px solid var(--cyan)',
      outlineOffset: 1,
    },
  },
  // タブが3つ並ぶと狭い画面では折り返すので、余白と文字を詰める
  '@media': {
    '(max-width: 420px)': {
      padding: '6px 4px',
      gap: 4,
      fontSize: '0.74rem',
    },
  },
});

export const dot = style({
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: 'var(--red)',
});
