import { globalStyle } from '@vanilla-extract/css';

/* ─── Reset ─────────────────────────────────────────────── */

globalStyle('*, *::before, *::after', {
  boxSizing: 'border-box',
  margin: 0,
  padding: 0,
});

globalStyle('html, body', {
  height: '100%',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  WebkitFontSmoothing: 'antialiased',
});

globalStyle('#root', {
  height: '100%',
});

globalStyle('button', {
  fontFamily: 'inherit',
  cursor: 'pointer',
  border: 'none',
  outline: 'none',
});

globalStyle('code', {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.8em',
  background: 'rgba(255, 255, 255, 0.06)',
  padding: '2px 6px',
  borderRadius: 4,
});

/* ─── Scrollbar ─────────────────────────────────────────── */

globalStyle('::-webkit-scrollbar', {
  width: 6,
});

globalStyle('::-webkit-scrollbar-track', {
  background: 'transparent',
});

globalStyle('::-webkit-scrollbar-thumb', {
  background: 'var(--border-bright)',
  borderRadius: 3,
});
