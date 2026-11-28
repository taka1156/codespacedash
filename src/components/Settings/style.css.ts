import { style, styleVariants } from '@vanilla-extract/css';

export const legend = style({
  fontSize: '0.82rem',
  color: 'var(--text)',
  fontWeight: 500,
  marginBottom: 8,
});

export const row = style({
  display: 'grid',
  gridTemplateColumns: '1fr 140px',
  alignItems: 'center',
  gap: 10,
  fontSize: '0.78rem',
  color: 'var(--text-muted)',
});

export const rowHint = style({
  display: 'block',
  fontSize: '0.68rem',
  color: 'var(--text-dim)',
});

export const control = style({
  width: '100%',
  padding: '5px 8px',
  borderRadius: 4,
  border: '1px solid var(--border-bright)',
  background: 'var(--bg-card)',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.78rem',
  selectors: {
    '&:focus-visible': {
      outline: '2px solid var(--cyan)',
      outlineOffset: 1,
    },
    '&:disabled': { opacity: 0.45 },
  },
});

export const group = style({
  border: 'none',
  padding: 0,
  margin: 0,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const switchRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid rgba(251, 191, 36, 0.3)',
  background: 'rgba(251, 191, 36, 0.06)',
  fontSize: '0.82rem',
  color: 'var(--text)',
  cursor: 'pointer',
});

export const actions = style({
  display: 'flex',
  gap: 8,
});

export const smallBtn = style({
  flex: 1,
  whiteSpace: 'nowrap',
  padding: '6px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-bright)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  selectors: {
    '&:hover:not(:disabled)': { color: 'var(--text)' },
    '&:disabled': { opacity: 0.45, cursor: 'default' },
  },
});

// ── お気に入りタブ ──

export const favAdd = style({
  display: 'flex',
  gap: 6,
});

export const favError = style({
  fontSize: '0.72rem',
  color: 'var(--red)',
});

export const favList = style({
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const favItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 4px 4px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
});

export const favName = style({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.78rem',
});

export const iconBtn = style({
  flexShrink: 0,
  width: 24,
  height: 24,
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  selectors: {
    '&:hover:not(:disabled)': {
      color: 'var(--text)',
      background: 'var(--bg-hover)',
    },
    '&:focus-visible': { outline: '2px solid var(--cyan)' },
    '&:disabled': { opacity: 0.3, cursor: 'default' },
  },
});

// ── トークン ──

export const tokenCard = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '12px 14px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
});

export const tokenHead = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

export const tokenName = style({
  fontSize: '0.85rem',
  fontWeight: 500,
  minWidth: 0,
});

export const tokenEnv = style({
  fontFamily: 'var(--font-mono)',
  fontSize: '0.72rem',
  fontWeight: 400,
  color: 'var(--text-muted)',
  overflowWrap: 'anywhere',
});

export const pill = style({
  flexShrink: 0,
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: '0.72rem',
  whiteSpace: 'nowrap',
});

export const pillLevel = styleVariants({
  ok: { background: 'rgba(74, 222, 128, 0.15)', color: 'var(--green)' },
  warn: { background: 'rgba(251, 191, 36, 0.15)', color: 'var(--yellow)' },
  danger: { background: 'rgba(248, 113, 113, 0.15)', color: 'var(--red)' },
  muted: { background: 'var(--bg-hover)', color: 'var(--text-muted)' },
});

export const tokenKv = style({
  display: 'grid',
  gridTemplateColumns: '48px minmax(0, 1fr)',
  alignItems: 'baseline',
  gap: '4px 8px',
  fontSize: '0.78rem',
  overflowWrap: 'anywhere',
});

export const tokenKvKey = style({
  color: 'var(--text-muted)',
});

export const tokenLink = style({
  alignSelf: 'flex-start',
  fontSize: '0.78rem',
  color: 'var(--cyan)',
  textDecoration: 'none',
  selectors: {
    '&:hover': { textDecoration: 'underline' },
  },
});

// ── 通知 ──

export const pushState = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: '0.82rem',
  color: 'var(--text)',
});

export const pushError = style({
  fontSize: '0.75rem',
  color: 'var(--red)',
});
