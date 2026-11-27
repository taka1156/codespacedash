import { style } from '@vanilla-extract/css';

export const icon = style({
  display: 'block',
  width: '1em',
  height: '1em',
  flexShrink: 0,
  // 回転させても SVG の中心が軸になるように
  transformOrigin: '50% 50%',
});
