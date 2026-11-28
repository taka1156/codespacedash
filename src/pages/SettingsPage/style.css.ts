import { style } from '@vanilla-extract/css';

const MOBILE = '(max-width: 600px)';

export const page = style({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
});

export const bar = style({
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '0 28px',
  paddingTop: 'env(safe-area-inset-top)',
  minHeight: 'calc(56px + env(safe-area-inset-top))',
  background: 'var(--bg-panel)',
  borderBottom: '1px solid var(--border)',
  position: 'sticky',
  top: 0,
  zIndex: 100,
  '@media': {
    [MOBILE]: { padding: '0 12px', paddingTop: 'env(safe-area-inset-top)' },
  },
});

export const back = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: '0.82rem',
  color: 'var(--text-muted)',
  textDecoration: 'none',
  selectors: {
    '&:hover': { color: 'var(--text)' },
    '&:focus-visible': { outline: '2px solid var(--cyan)', outlineOffset: 2 },
  },
});

export const backText = style({
  '@media': { [MOBILE]: { display: 'none' } },
});

export const title = style({
  fontSize: '0.95rem',
  fontWeight: 600,
});

export const body = style({
  flex: 1,
  width: '100%',
  maxWidth: 880,
  margin: '0 auto',
  padding: 28,
  display: 'grid',
  gridTemplateColumns: '180px minmax(0, 1fr)',
  alignItems: 'start',
  // 余った高さで行を引き伸ばさない（スマホでメニューと中身が離れる）
  alignContent: 'start',
  gap: 24,
  '@media': {
    [MOBILE]: {
      padding: 16,
      gridTemplateColumns: 'minmax(0, 1fr)',
      gap: 14,
    },
  },
});

export const nav = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  position: 'sticky',
  top: 'calc(56px + env(safe-area-inset-top) + 28px)',
  '@media': {
    // スマホは横に並べて、入りきらない分は横スクロール
    [MOBILE]: {
      position: 'static',
      flexDirection: 'row',
      gap: 4,
      overflowX: 'auto',
      scrollbarWidth: 'none',
      margin: '0 -16px',
      padding: '0 16px',
    },
  },
});

export const navItem = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '8px 12px',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '0.85rem',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  selectors: {
    '&:hover': { color: 'var(--text)' },
    '&[aria-selected="true"]': {
      background: 'var(--bg-hover)',
      color: 'var(--text)',
    },
    '&:focus-visible': { outline: '2px solid var(--cyan)', outlineOffset: 1 },
  },
  '@media': {
    [MOBILE]: { flexShrink: 0, padding: '6px 12px', fontSize: '0.8rem' },
  },
});

export const navDebugOn = style({
  color: 'var(--yellow)',
  selectors: {
    '&[aria-selected="true"]': { color: 'var(--yellow)' },
  },
});

export const dot = style({
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: 'var(--yellow)',
  flexShrink: 0,
});

export const panel = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 20,
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  '@media': { [MOBILE]: { padding: 14 } },
});
