import { globalStyle, style } from '@vanilla-extract/css';

/** Driver.js の吹き出しをダッシュボードの暗い配色に合わせる */
export const tourPopover = style({
  fontFamily: 'var(--font-sans)',
  color: 'var(--text)',
  background: 'var(--bg-card)',
  border: '1px solid var(--border-bright)',
  borderRadius: 'var(--radius)',
  padding: 16,
  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
  // driver.css より後に読まれる保証がないので、詳細度を上げて確実に上書きする
  selectors: {
    '&.driver-popover': {
      fontFamily: 'var(--font-sans)',
      color: 'var(--text)',
      backgroundColor: 'var(--bg-card)',
      maxWidth: 'min(320px, calc(100vw - 24px))',
    },
  },
});

globalStyle(`${tourPopover} .driver-popover-title`, {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.95rem',
  fontWeight: 600,
});

globalStyle(`${tourPopover} .driver-popover-description`, {
  fontSize: '0.85rem',
  lineHeight: 1.7,
  color: 'var(--text-muted)',
});

globalStyle(`${tourPopover} .driver-popover-progress-text`, {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
});

globalStyle(`${tourPopover} .driver-popover-close-btn`, {
  color: 'var(--text-muted)',
});

globalStyle(
  `${tourPopover} .driver-popover-close-btn:hover, ${tourPopover} .driver-popover-close-btn:focus-visible`,
  { color: 'var(--text)' },
);

globalStyle(`${tourPopover} .driver-popover-footer-btn`, {
  fontFamily: 'var(--font-sans)',
  fontSize: '0.8rem',
  padding: '5px 12px',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  background: 'var(--bg-hover)',
  border: '1px solid var(--border-bright)',
  textShadow: 'none',
});

globalStyle(
  `${tourPopover} .driver-popover-footer-btn:hover, ${tourPopover} .driver-popover-footer-btn:focus-visible`,
  { background: 'var(--cyan-dim)', color: 'var(--cyan)' },
);

globalStyle(`${tourPopover} .driver-popover-next-btn`, {
  color: '#0d1117',
  background: 'var(--cyan)',
  borderColor: 'var(--cyan)',
});

globalStyle(`${tourPopover} .driver-popover-arrow`, {
  borderColor: 'var(--bg-card)',
});

// 矢印は向き以外の辺を透明にする（driver.css と同じ指定を、上で変えた色の後に）
for (const [side, clear] of [
  ['left', ['Top', 'Bottom', 'Right']],
  ['right', ['Top', 'Bottom', 'Left']],
  ['top', ['Bottom', 'Left', 'Right']],
  ['bottom', ['Top', 'Left', 'Right']],
] as const) {
  globalStyle(
    `${tourPopover} .driver-popover-arrow-side-${side}`,
    Object.fromEntries(clear.map((c) => [`border${c}Color`, 'transparent'])),
  );
}
