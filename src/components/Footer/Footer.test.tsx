import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Footer, REPOSITORY_URL } from './Footer';

describe('Footer', () => {
  it('コピーライトとリポジトリへのリンクだけを出す', () => {
    render(<Footer />);
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      '© 2026 taka1156',
    );
    expect(
      screen
        .getAllByRole('link')
        .map((a) => [a.textContent, a.getAttribute('href')]),
    ).toEqual([['GitHub ↗', REPOSITORY_URL]]);
  });

  it('リンクは別タブで開く', () => {
    render(<Footer />);
    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank');
  });
});
