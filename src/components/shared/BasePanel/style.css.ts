import { style } from '@vanilla-extract/css';

/** PC（3列）のときのパネルの高さ。どのタブ・どのパネルでも同じにして、切り替えで画面が動かないようにする */
export const DESKTOP_MEDIA = '(min-width: 1100px)';
export const PANEL_HEIGHT = 'clamp(560px, calc(100dvh - 190px), 860px)';

export const panel = style({
  display: 'flex',
  flexDirection: 'column',
  // グリッドの子は min-width: auto なので、長い名前で列が押し広げられないようにする
  minWidth: 0,
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
  '@media': {
    [DESKTOP_MEDIA]: {
      height: PANEL_HEIGHT,
    },
  },
});

/** ヘッダーより下。PC では枠の高さが固定なので、ここだけスクロールする */
export const panelBody = style({
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  '@media': {
    [DESKTOP_MEDIA]: {
      flex: 1,
      overflowY: 'auto',
      scrollbarGutter: 'stable',
      marginRight: -12,
      paddingRight: 6,
    },
  },
});

export const panelHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  // サブタイトルやバッジの有無で中身の開始位置がずれないように高さをそろえる
  minHeight: 48,
  marginBottom: 16,
  flexShrink: 0,
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
  flexShrink: 0,
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
  fontWeight: 600,
  padding: '4px 12px',
  borderRadius: 20,
  background: 'var(--bg-card)',
  border: '1px solid var(--border-bright)',
  color: 'var(--text-muted)',
});
