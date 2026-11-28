import { style } from '@vanilla-extract/css';

export const footer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexWrap: 'wrap',
  gap: 16,
  padding: '16px 0 20px',
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
});

export const footerLink = style({
  color: 'var(--text-muted)',
  textDecoration: 'none',
  selectors: {
    '&:hover': { color: 'var(--text)', textDecoration: 'underline' },
  },
});
