import { style } from '@vanilla-extract/css';

export const panel = style({
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: 24,
  '@media': {
    '(max-width: 600px)': {
      padding: 16,
    },
  },
});

export const head = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 16,
});

export const title = style({
  fontFamily: 'var(--font-mono)',
  fontSize: '0.95rem',
  fontWeight: 600,
  marginBottom: 4,
});

export const sub = style({
  fontSize: '0.78rem',
  color: 'var(--text-muted)',
});

export const headActions = style({
  display: 'flex',
  gap: 8,
});

export const smallBtn = style({
  fontSize: '0.75rem',
  padding: '5px 10px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-card)',
  border: '1px solid var(--border-bright)',
  color: 'var(--text-muted)',
  selectors: {
    '&:hover': { color: 'var(--text)' },
    '&:focus-visible': { outline: '2px solid var(--cyan)' },
  },
});

export const repoList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const repo = style({
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-card)',
  overflow: 'hidden',
});

export const repoHead = style({
  display: 'flex',
  alignItems: 'stretch',
  margin: 0,
  fontSize: 'inherit',
  fontWeight: 'inherit',
});

export const toggle = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 14px',
  background: 'transparent',
  color: 'var(--text)',
  textAlign: 'left',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
  selectors: {
    '&:hover': { background: 'var(--bg-hover)' },
    '&:focus-visible': { outline: '2px solid var(--cyan)', outlineOffset: -2 },
  },
});

export const chevron = style({
  flexShrink: 0,
  width: 12,
  color: 'var(--text-muted)',
  transition: 'transform 0.15s',
});

export const chevronOpen = style({
  transform: 'rotate(90deg)',
});

export const repoName = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
});

export const repoNote = style({
  fontFamily: 'var(--font-sans)',
  fontSize: '0.72rem',
  color: 'var(--yellow)',
  whiteSpace: 'nowrap',
});

export const count = style({
  marginLeft: 'auto',
  flexShrink: 0,
  fontVariantNumeric: 'tabular-nums',
  fontSize: '0.75rem',
  fontWeight: 600,
  padding: '1px 9px',
  borderRadius: 20,
  border: '1px solid var(--border-bright)',
  color: 'var(--text-muted)',
});

export const countActive = style({
  color: 'var(--green)',
  borderColor: 'rgba(74, 222, 128, 0.35)',
});

export const external = style({
  display: 'flex',
  alignItems: 'center',
  padding: '0 14px',
  color: 'var(--text-muted)',
  textDecoration: 'none',
  borderLeft: '1px solid var(--border)',
  selectors: {
    '&:hover': { color: 'var(--text)', background: 'var(--bg-hover)' },
  },
});

export const body = style({
  borderTop: '1px solid var(--border)',
  padding: '4px 8px',
});

export const pullItem = style({
  display: 'grid',
  gridTemplateColumns: '18px 1fr auto',
  gap: '2px 10px',
  alignItems: 'start',
  padding: '10px 6px',
  borderRadius: 'var(--radius-sm)',
  color: 'inherit',
  textDecoration: 'none',
  selectors: {
    '&:hover': { background: 'var(--bg-hover)' },
    '& + &': { borderTop: '1px solid var(--border)' },
  },
});

export const icon = style({
  width: 18,
  height: 18,
  marginTop: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.75rem',
  fontWeight: 700,
  borderRadius: '50%',
});

export const iconOpen = style({
  color: 'var(--green)',
  background: 'rgba(74, 222, 128, 0.12)',
});

export const iconDraft = style({
  color: 'var(--text-muted)',
  background: 'rgba(255, 255, 255, 0.06)',
});

export const pullTitle = style({
  fontSize: '0.84rem',
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
});

export const time = style({
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
  textAlign: 'right',
});

export const meta = style({
  gridColumn: '2 / 4',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '2px 10px',
  fontSize: '0.72rem',
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-mono)',
});

export const metaStrong = style({
  color: 'var(--text-muted)',
});

export const review = style({
  fontFamily: 'var(--font-sans)',
  padding: '0 7px',
  borderRadius: 10,
  border: '1px solid currentColor',
});

export const reviewApproved = style({ color: 'var(--green)' });
export const reviewChanges = style({ color: 'var(--red)' });
export const reviewRequired = style({ color: 'var(--yellow)' });

export const more = style({
  display: 'block',
  padding: '8px 6px 10px',
  fontSize: '0.75rem',
  color: 'var(--cyan)',
  textDecoration: 'none',
  selectors: {
    '&:hover': { textDecoration: 'underline' },
  },
});

export const emptyState = style({
  textAlign: 'center',
  padding: '20px 12px',
  color: 'var(--text-muted)',
  fontSize: '0.82rem',
  lineHeight: 1.7,
});

export const skeleton = style({
  height: 46,
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  opacity: 0.6,
});

export const staleNote = style({
  fontSize: '0.78rem',
  color: 'var(--red)',
  marginBottom: 12,
  overflowWrap: 'anywhere',
});
