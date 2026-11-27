import { keyframes, style } from '@vanilla-extract/css';
import {
  DESKTOP_MEDIA,
  PANEL_HEIGHT,
} from '@/components/shared/BasePanel/style.css';

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

// PC は3列固定、それ以外は1列。2列だと3枚目が1枚だけ余るので作らない
export const dashboardGrid = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 20,
  '@media': {
    [DESKTOP_MEDIA]: {
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    },
  },
});

export const serviceTabs = style({
  maxWidth: 480,
  marginBottom: 20,
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
  '@media': {
    [DESKTOP_MEDIA]: {
      height: PANEL_HEIGHT,
    },
  },
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  animation: `${shimmer} 1.4s ease infinite`,
});

export const previewBanner = style({
  background: 'rgba(251, 191, 36, 0.06)',
  border: '1px solid rgba(251, 191, 36, 0.3)',
  borderRadius: 'var(--radius-sm)',
  padding: '12px 16px',
  fontSize: '0.82rem',
  lineHeight: 1.6,
  color: 'var(--text-muted)',
  marginBottom: 20,
});
