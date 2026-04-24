import { style } from '@vanilla-extract/css';

export const copilotGrid = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const copilotCard = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '14px 16',
});

export const copilotPremiumNote = style({
  background: 'rgba(167, 139, 250, 0.04)',
  borderColor: 'rgba(167, 139, 250, 0.15)',
});

export const copilotIcon = style({
  fontSize: '1.1rem',
  flexShrink: 0,
  marginTop: 1,
});

export const copilotLabel = style({
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 3,
});

export const copilotVal = style({
  fontFamily: 'var(--font-mono)',
  fontSize: '0.9rem',
  fontWeight: 500,
});

export const copilotValSmall = style({
  fontSize: '0.8rem',
  color: 'var(--text-muted)',
  lineHeight: 1.5,
});

/* ─── Copilot model list ────────────────────────────────── */
export const copilotModelList = style({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 8,
});

export const copilotModelItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: '0.8rem',
});

export const modelDot = style({
  width: 8,
  height: 8,
  borderRadius: '50%',
  flexShrink: 0,
});

export const modelName = style({
  flex: 1,
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.75rem',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const modelCount = style({
  fontFamily: 'var(--font-mono)',
  fontSize: '0.8rem',
  color: 'var(--text)',
});

/ * プレミアムリクエスト統計 ──────────────────────────────── */;

export const billingGrid = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 20,
  marginBottom: 20,
  '@media': {
    '(max-width: 600px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const billingStats = style({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-start',
  gap: 12,
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

/* モデル別棒グラフ ──────────────────────────────── */
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
