import { keyframes, style } from '@vanilla-extract/css';

export const app = style({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
});

export const main = style({
  flex: 1,
  padding: 28,
  maxWidth: 1400,
  margin: '0 auto',
  width: '100%',
  '@media': {
    '(max-width: 600px)': {
      padding: 16,
    },
  },
});

export const dashboardGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
  gap: 20,
  alignItems: 'start',
  '@media': {
    '(max-width: 600px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const loadingGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
  gap: 20,
});

export const errorBanner = style({
  background: 'rgba(248, 113, 113, 0.08)',
  border: '1px solid rgba(248, 113, 113, 0.25)',
  borderRadius: 'var(--radius-sm)',
  padding: '12px 16px',
  fontSize: '0.85rem',
  color: 'var(--red)',
  marginBottom: 20,
});

const shimmer = keyframes({
  '0%': {
    backgroundPosition: '100% 0',
  },
  '100%': {
    backgroundPosition: '-100% 0',
  },
});

export const skeletonPanel = style({
  height: 200,
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  animation: `${shimmer} 1.4s ease infinite`,
});
