import { keyframes, style } from '@vanilla-extract/css';

export const emptyState = style({
  textAlign: 'center',
  padding: '32px 20px',
  color: 'var(--text-muted)',
  fontSize: '0.85rem',
  lineHeight: 1.7,
});

export const runList = style({
  display: 'flex',
  flexDirection: 'column',
});

export const runItem = style({
  display: 'grid',
  gridTemplateColumns: '18px 1fr auto',
  gap: '2px 10px',
  alignItems: 'start',
  padding: '10px 8px',
  borderRadius: 'var(--radius-sm)',
  color: 'inherit',
  textDecoration: 'none',
  transition: 'background 0.15s',
  selectors: {
    '&:hover': {
      background: 'var(--bg-hover)',
    },
    '& + &': {
      borderTop: '1px solid var(--border)',
    },
  },
});

const spin = keyframes({ to: { transform: 'rotate(360deg)' } });

export const icon = style({
  width: 18,
  height: 18,
  marginTop: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.8rem',
  fontWeight: 700,
  borderRadius: '50%',
});

export const iconSuccess = style({
  color: 'var(--green)',
  background: 'rgba(74, 222, 128, 0.12)',
});

export const iconFailure = style({
  color: 'var(--red)',
  background: 'rgba(248, 113, 113, 0.12)',
});

export const iconNeutral = style({
  color: 'var(--text-muted)',
  background: 'rgba(255, 255, 255, 0.06)',
});

export const iconRunning = style({
  border: '2px solid rgba(251, 191, 36, 0.25)',
  borderTopColor: 'var(--yellow)',
  animation: `${spin} 0.9s linear infinite`,
});

export const iconQueued = style({
  color: 'var(--yellow)',
  background: 'rgba(251, 191, 36, 0.12)',
});

export const title = style({
  fontSize: '0.84rem',
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
});

export const workflow = style({
  color: 'var(--text-muted)',
  fontWeight: 400,
});

export const meta = style({
  gridColumn: '2 / 4',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '2px 10px',
  fontSize: '0.72rem',
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-mono)',
});

export const metaRepo = style({
  color: 'var(--text-muted)',
});

export const time = style({
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
  textAlign: 'right',
});

export const section = style({
  marginTop: 20,
  paddingTop: 16,
  borderTop: '1px solid var(--border)',
});

export const sectionHead = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '4px 12px',
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  letterSpacing: '0.08em',
  fontFamily: 'var(--font-mono)',
  marginBottom: 6,
});

export const sectionNote = style({
  fontSize: '0.7rem',
  letterSpacing: 0,
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-sans)',
});
