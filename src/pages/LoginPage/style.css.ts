import { keyframes, style } from '@vanilla-extract/css';

export const loginRoot = style({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: [
    'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(34, 211, 238, 0.06) 0%, transparent 70%)',
    'radial-gradient(ellipse 40% 30% at 80% 80%, rgba(167, 139, 250, 0.05) 0%, transparent 70%)',
    'var(--bg)',
  ],
});

export const loginCard = style({
  width: 380,
  background: 'var(--bg-panel)',
  border: '1px solid var(--border-bright)',
  borderRadius: 16,
  padding: '48px 40px',
  textAlign: 'center',
  opacity: 0,
  transform: 'translateY(16px)',
  transition: 'opacity 0.4s ease, transform 0.4s ease',
});

export const loginCardMounted = style({
  opacity: 1,
  transform: 'translateY(0)',
});

export const loginLogo = style({
  color: 'var(--text)',
  marginBottom: 24,
  display: 'flex',
  justifyContent: 'center',
});

export const loginLogoImg = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const loginTitle = style({
  fontFamily: 'var(--font-mono)',
  fontSize: '1.4rem',
  fontWeight: 600,
  marginBottom: 6,
  letterSpacing: '-0.02em',
});

export const loginSub = style({
  color: 'var(--text-muted)',
  fontSize: '0.85rem',
  marginBottom: 32,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
});

export const loginBtn = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  width: '100%',
  padding: '14px 20px',
  background: 'var(--text)',
  color: '#0d1117',
  borderRadius: 'var(--radius-sm)',
  fontWeight: 600,
  fontSize: '0.95rem',
  transition: 'background 0.2s, transform 0.15s',
  selectors: {
    '&:hover': {
      background: '#fff',
      transform: 'translateY(-1px)',
    },
    '&:active': {
      transform: 'translateY(0)',
    },
  },
});

export const loginError = style({
  background: 'rgba(248, 113, 113, 0.1)',
  border: '1px solid rgba(248, 113, 113, 0.3)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px 14px',
  fontSize: '0.85rem',
  color: 'var(--red)',
  marginBottom: 16,
});

/* PAT input */
export const patField = style({
  textAlign: 'left',
  marginBottom: 16,
});

export const patLabel = style({
  display: 'block',
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 8,
  fontFamily: 'var(--font-mono)',
});

export const patInputWrap = style({
  position: 'relative',
});

export const patInput = style({
  width: '100%',
  padding: '12px 44px 12px 14px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border-bright)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  outline: 'none',
});

export const patInputFocus = style({
  borderColor: 'var(--cyan)',
  boxShadow: '0 0 0 3px rgba(34, 211, 238, 0.1)',
});

export const patInputPlaceholder = style({
  color: 'var(--text-dim)',
});

export const patToggle = style({
  position: 'absolute',
  right: 10,
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  fontSize: '0.95rem',
  opacity: 0.5,
  transition: 'opacity 0.2s',
  lineHeight: 1,
  selectors: {
    '&:hover': {
      opacity: 1,
    },
  },
});

export const patHint = style({
  fontSize: '0.72rem',
  color: 'var(--yellow)',
  marginTop: 6,
  fontFamily: 'var(--font-mono)',
});

/* Scope section */
export const scopeSection = style({
  textAlign: 'left',
  marginTop: 20,
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '14px 16px',
});

export const scopeTitle = style({
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 10,
});

export const scopeList = style({
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginBottom: 12,
});

export const scopeItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: '0.8rem',
});

export const scopeItemCode = style({
  fontSize: '0.75rem',
  whiteSpace: 'nowrap',
});

export const scopeItemSpan = style({
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
});

export const scopeLink = style({
  display: 'inline-block',
  fontSize: '0.77rem',
  color: 'var(--cyan)',
  textDecoration: 'none',
  fontFamily: 'var(--font-mono)',
  transition: 'opacity 0.2s',
  selectors: {
    '&:hover': {
      opacity: 0.7,
    },
  },
});

/* Login notice */
export const loginNotice = style({
  marginTop: 14,
  fontSize: '0.75rem',
  color: 'var(--text-dim)',
  lineHeight: 1.6,
});

/* Btn loading */
export const loginBtnLoading = style({
  opacity: 0.7,
  cursor: 'not-allowed',
});

export const loginBtnDisabled = style({
  opacity: 0.5,
  cursor: 'not-allowed',
  transform: 'none',
});

const spin = keyframes({
  to: {
    transform: 'rotate(360deg)',
  },
});

export const btnSpinner = style({
  display: 'inline-block',
  width: 14,
  height: 14,
  border: '2px solid rgba(0, 0, 0, 0.2)',
  borderTopColor: '#0d1117',
  borderRadius: '50%',
  animation: `${spin} 0.7s linear infinite`,
});
