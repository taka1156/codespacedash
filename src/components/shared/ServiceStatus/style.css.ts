import { style } from '@vanilla-extract/css';

export const strips = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginBottom: 12,
});

/** 障害の帯（黄: 性能低下・メンテナンス、赤: 一部・全面障害） */
export const strip = style({
  fontSize: '0.75rem',
  lineHeight: 1.5,
  padding: '6px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid rgba(251, 191, 36, 0.3)',
  background: 'rgba(251, 191, 36, 0.08)',
  color: 'var(--yellow)',
  overflowWrap: 'anywhere',
});

export const stripSevere = style({
  borderColor: 'rgba(248, 113, 113, 0.3)',
  background: 'rgba(248, 113, 113, 0.08)',
  color: 'var(--red)',
});

export const stripLabel = style({
  fontWeight: 600,
});

export const stripLink = style({
  color: 'inherit',
  textDecoration: 'underline',
  whiteSpace: 'nowrap',
});

/** 取得エラーの枠に添える一言 */
export const hint = style({
  display: 'block',
  marginTop: 8,
  fontSize: '0.75rem',
  color: 'var(--yellow)',
});

export const footer = style({
  display: 'flex',
  justifyContent: 'center',
  flexWrap: 'wrap',
  gap: 16,
  padding: '16px 0 4px',
  fontSize: '0.75rem',
});

export const footerLink = style({
  color: 'var(--text-muted)',
  textDecoration: 'none',
  selectors: {
    '&:hover': { color: 'var(--text)', textDecoration: 'underline' },
  },
});
