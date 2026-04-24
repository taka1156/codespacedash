import { style } from '@vanilla-extract/css';

export const emptyState = style({
  textAlign: 'center',
  padding: '40px 20px',
  color: 'var(--text-muted)',
  fontSize: '0.85rem',
  lineHeight: 1.7,
});

export const emptyStateSmall = style({
  opacity: 0.6,
});

export const billingGrid = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '20px',
  marginBottom: '20px',
  '@media': {
    '(max-width: 600px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const radialWrap = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const radialCenter = style({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  textAlign: 'center',
  pointerEvents: 'none',
});

export const radialValue = style({
  display: 'block',
  fontFamily: 'var(--font-mono)',
  fontSize: '1.3rem',
  fontWeight: 600,
});

export const radialUnit = style({
  fontSize: '0.7rem',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono)',
});

export const billingStats = style({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '12px',
});

export const bstat = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
});

export const bstatLabel = style({
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
});

export const bstatVal = style({
  fontFamily: 'var(--font-mono)',
  fontSize: '1rem',
  fontWeight: 600,
});

export const accentCyan = style({
  color: 'var(--cyan)',
});

export const accentGreen = style({
  color: 'var(--green)',
});

export const accentRed = style({
  color: 'var(--red)',
});

export const accentOrange = style({
  color: 'var(--orange)',
});

export const breakdownWrap = style({
  borderTop: '1px solid var(--border)',
  paddingTop: '16px',
});

export const breakdownTitle = style({
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px',
  fontFamily: 'var(--font-mono)',
});

export const breakdownGrid = style({
  width: '100%',
});
