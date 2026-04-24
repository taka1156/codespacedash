import { keyframes, style } from '@vanilla-extract/css';

export const emptyState = style({
  textAlign: 'center',
  padding: '40px 20px',
  color: 'var(--text-muted)',
  fontSize: '0.85rem',
  lineHeight: 1.7,
});

export const csList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const csItem = style({
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '14px 16px',
  transition: 'border-color 0.15s',
  selectors: {
    '&:hover': {
      borderColor: 'var(--border-bright)',
    },
  },
});

export const csTop = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
});

export const stateDot = style({
  width: 7,
  height: 7,
  borderRadius: '50%',
  flexShrink: 0,
});

export const stateAvailable = style({
  background: 'var(--green)',
  boxShadow: '0 0 6px var(--green)',
});

const pulse = keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0.4 },
});

export const stateStarting = style({
  background: 'var(--yellow)',
  boxShadow: '0 0 6px var(--yellow)',
  animation: `${pulse} 1.5s ease-in-out infinite`,
});

export const stateStopping = style({
  background: 'var(--orange)',
});

export const stateFailed = style({
  background: 'var(--red)',
});

export const csName = style({
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
  fontWeight: 500,
  flex: 1,
});

export const stateBadge = style({
  fontSize: '0.7rem',
  padding: '2px 8px',
  borderRadius: 4,
  fontFamily: 'var(--font-mono)',
});

export const stateAvailableBadge = style({
  background: 'rgba(74, 222, 128, 0.1)',
  color: 'var(--green)',
});

export const stateStartingBadge = style({
  background: 'rgba(251, 191, 36, 0.1)',
  color: 'var(--yellow)',
});

export const stateStoppingBadge = style({
  background: 'rgba(249, 115, 22, 0.1)',
  color: 'var(--orange)',
});

export const stateFailedBadge = style({
  background: 'rgba(248, 113, 113, 0.1)',
  color: 'var(--red)',
});

export const csMeta = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const csRepo = style({
  fontSize: '0.78rem',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono)',
});

export const csDetail = style({
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
});

export const csDetailSpan = style({
  fontSize: '0.75rem',
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-mono)',
});

export const csTime = style({
  fontSize: '0.73rem',
  color: 'var(--text-dim)',
});
