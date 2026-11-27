import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';
import { icon } from './style.css';

describe('Icon', () => {
  it('読み上げ対象外の SVG を描く', () => {
    const { container } = render(<Icon name="bell" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('data-icon', 'bell');
    expect(svg).toHaveClass(icon);
  });

  it('className を足せる', () => {
    const { container } = render(<Icon name="refresh" className="extra" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass(icon);
    expect(svg).toHaveClass('extra');
  });
});
