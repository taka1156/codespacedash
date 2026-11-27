import { style } from '@vanilla-extract/css';

export const wrap = style({
  position: 'relative',
});

export const trigger = style({
  width: 32,
  height: 32,
  borderRadius: 8,
  background: 'var(--bg-card)',
  color: 'var(--text-muted)',
  fontSize: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'color 0.2s, background 0.2s',
  selectors: {
    '&:hover, &[aria-expanded="true"]': {
      color: 'var(--text)',
      background: 'var(--bg-hover)',
    },
  },
});

export const popover = style({
  position: 'absolute',
  right: 0,
  top: 'calc(100% + 8px)',
  width: 280,
  padding: 14,
  background: 'var(--bg-panel)',
  border: '1px solid var(--border-bright)',
  borderRadius: 'var(--radius)',
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
  zIndex: 200,
  '@media': {
    '(max-width: 600px)': {
      position: 'fixed',
      left: 12,
      right: 12,
      top: 'calc(64px + env(safe-area-inset-top))',
      width: 'auto',
    },
  },
});

export const title = style({
  fontFamily: 'var(--font-mono)',
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 10,
});

export const fieldset = style({
  border: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const legend = style({
  fontSize: '0.82rem',
  color: 'var(--text)',
  fontWeight: 500,
  marginBottom: 8,
});

export const option = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  cursor: 'pointer',
  transition: 'border-color 0.15s, background 0.15s',
  selectors: {
    '&:hover': {
      borderColor: 'var(--border-bright)',
    },
    '&:has(input:checked)': {
      borderColor: 'var(--accent, var(--cyan))',
      background: 'var(--accent-dim, var(--cyan-dim))',
    },
    '&:has(input:focus-visible)': {
      outline: '2px solid var(--accent, var(--cyan))',
      outlineOffset: 2,
    },
  },
});

export const radio = style({
  marginTop: 3,
  accentColor: 'var(--accent, var(--cyan))',
});

export const optionName = style({
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
  fontWeight: 600,
  display: 'block',
});

export const optionDesc = style({
  fontSize: '0.74rem',
  color: 'var(--text-muted)',
  lineHeight: 1.5,
  display: 'block',
  marginTop: 2,
});

export const warn = style({
  color: 'var(--yellow)',
});

export const tabs = style({
  display: 'flex',
  gap: 4,
  padding: 3,
  marginBottom: 14,
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-sm)',
});

export const tab = style({
  flex: 1,
  padding: '6px 8px',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '0.78rem',
  fontWeight: 500,
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
});

export const tabDebugOn = style({
  color: 'var(--yellow)',
  selectors: {
    '&[aria-selected="true"]': { color: 'var(--yellow)' },
  },
});

export const scroll = style({
  maxHeight: 'min(70vh, 560px)',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
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
