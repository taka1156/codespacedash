import { globalStyle, keyframes, style } from '@vanilla-extract/css';

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 28px',
  // PWA(standalone)でノッチ・ステータスバーに被らないように
  paddingTop: 'env(safe-area-inset-top)',
  minHeight: 'calc(56px + env(safe-area-inset-top))',
  gap: 12,
  background: 'var(--bg-panel)',
  borderBottom: '1px solid var(--border)',
  position: 'sticky',
  top: 0,
  zIndex: 100,
  '@media': {
    '(max-width: 600px)': {
      padding: '0 12px',
      paddingTop: 'env(safe-area-inset-top)',
    },
  },
});

export const headerLeft = style({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  minWidth: 0,
  '@media': {
    '(max-width: 600px)': {
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 0,
    },
  },
});

export const headerLogo = style({
  width: '130px',
  height: '50px',
  // 右側のボタンが長くてもロゴを押し縮めない
  flexShrink: 0,
  '@media': {
    '(max-width: 380px)': {
      width: '112px',
    },
  },
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

globalStyle(`${headerLogo} img`, {
  display: 'block',
  maxWidth: '100%',
  height: 'auto',
});

export const headerTitle = style({
  fontFamily: 'var(--font-mono)',
  fontSize: '0.9rem',
  fontWeight: 600,
  letterSpacing: '-0.01em',
});

export const headerRight = style({
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  '@media': {
    '(max-width: 600px)': {
      gap: 6,
    },
  },
});

export const lastFetchedStyle = style({
  fontSize: '0.75rem',
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-mono)',
  '@media': {
    '(max-width: 600px)': {
      display: 'none',
    },
  },
});

export const btnRefresh = style({
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  background: 'var(--bg-card)',
  color: 'var(--text-muted)',
  fontSize: '16px',
  transition: 'color 0.2s, background 0.2s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  selectors: {
    '&:hover': {
      color: 'var(--cyan)',
      background: 'var(--cyan-dim)',
    },
  },
});

const spin = keyframes({
  to: {
    transform: 'rotate(360deg)',
  },
});

export const btnRefreshSpinning = style({
  animation: `${spin} 0.7s linear infinite`,
});

export const userInfo = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const avatar = style({
  width: '26px',
  height: '26px',
  borderRadius: '50%',
  border: '1px solid var(--border-bright)',
});

export const username = style({
  fontSize: '0.85rem',
  fontWeight: 500,
  color: 'var(--text-muted)',
  '@media': {
    '(max-width: 600px)': {
      display: 'none',
    },
  },
});

export const btnGhost = style({
  padding: '5px 12px',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-muted)',
  fontSize: '0.8rem',
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  transition: 'border-color 0.2s, color 0.2s',
  selectors: {
    '&:hover:not(:disabled)': {
      borderColor: 'var(--border-bright)',
      color: 'var(--text)',
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'default',
    },
  },
});

/** アイコン + 文字のボタン。アイコンと文字の縦位置を揃える */
export const btnIconText = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  lineHeight: 1.4,
});

globalStyle(`${btnIconText} svg`, {
  fontSize: '14px',
});

export const btnNotifyOn = style({
  borderColor: 'rgba(74, 222, 128, 0.35)',
  color: 'var(--green)',
});

export const hideOnMobile = style({
  '@media': {
    '(max-width: 600px)': {
      display: 'none',
    },
  },
});

export const pushError = style({
  position: 'absolute',
  right: 16,
  top: 'calc(100% + 6px)',
  maxWidth: 320,
  padding: '8px 12px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-card)',
  border: '1px solid rgba(248, 113, 113, 0.35)',
  color: 'var(--red)',
  fontSize: '0.78rem',
});

export const debugBadge = style({
  fontFamily: 'var(--font-mono)',
  fontSize: '0.68rem',
  fontWeight: 600,
  letterSpacing: '0.1em',
  padding: '2px 7px',
  borderRadius: 4,
  color: '#0d1117',
  background: 'var(--yellow)',
  flexShrink: 0,
  '@media': {
    '(max-width: 600px)': {
      fontSize: '0.55rem',
      padding: '0 5px',
      lineHeight: 1.6,
      marginLeft: 34,
      marginTop: -10,
    },
  },
});
