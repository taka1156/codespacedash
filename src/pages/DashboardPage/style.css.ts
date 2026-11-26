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

// パネルの最小幅 420px・間隔 20px・main の左右余白 28px から決めた切り替え幅
const TWO_COLUMNS = '(min-width: 916px)';
const THREE_COLUMNS = '(min-width: 1356px)';

/**
 * 1列: Codespaces → Actions/Workers → AI
 * 2列（タブレット）: 左に Codespaces と AI を縦に詰め、右に背の高い Actions/Workers。
 *   1行目を Codespaces の高さ（auto）、2行目を残り（1fr）にすることで、
 *   右の背の高いパネルにつられて Codespaces の下に空白ができないようにする
 * 3列: 横に3つ並べる
 */
export const dashboardGrid = style({
  display: 'grid',
  gap: 20,
  alignItems: 'start',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gridTemplateAreas: '"cs" "builds" "ai"',
  '@media': {
    [TWO_COLUMNS]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gridTemplateRows: 'auto 1fr',
      gridTemplateAreas: '"cs builds" "ai builds"',
    },
    [THREE_COLUMNS]: {
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gridTemplateRows: 'auto',
      gridTemplateAreas: '"cs builds ai"',
    },
  },
});

export const areaCs = style({ gridArea: 'cs', minWidth: 0 });
export const areaBuilds = style({ gridArea: 'builds', minWidth: 0 });
export const areaAi = style({ gridArea: 'ai', minWidth: 0 });

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
