import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuotaBar } from './QuotaBar';
import { quotaLow, quotaOk } from './style.css';

const fill = (c: HTMLElement) =>
  c.querySelector('[aria-hidden="true"] > div') as HTMLElement;

describe('QuotaBar', () => {
  it('使用量と割合を出す', () => {
    const { container } = render(
      <QuotaBar label="コア時間" used={30} free={120} unit="時間" />,
    );
    expect(screen.getByText('コア時間')).toBeInTheDocument();
    expect(container).toHaveTextContent('使用 30 / 120 時間 ・ 25%');
    expect(fill(container)).toHaveStyle({ width: '25%' });
    expect(fill(container)).toHaveClass(quotaOk);
  });

  it('8割を超えたら赤', () => {
    const { container } = render(
      <QuotaBar label="x" used={81} free={100} unit="分" />,
    );
    expect(fill(container)).toHaveClass(quotaLow);
  });

  it('ちょうど8割はまだ赤くしない', () => {
    const { container } = render(
      <QuotaBar label="x" used={80} free={100} unit="分" />,
    );
    expect(fill(container)).toHaveClass(quotaOk);
  });

  it('枠を超えてもバーは 100% で止める', () => {
    const { container } = render(
      <QuotaBar label="x" used={2500} free={2000} unit="分" />,
    );
    expect(container).toHaveTextContent('125%');
    expect(fill(container)).toHaveStyle({ width: '100%' });
  });

  it('取れなかったときは理由と枠だけを出し、バーは空', () => {
    const { container } = render(
      <QuotaBar label="x" free={2000} unit="分" unavailable="未設定" />,
    );
    expect(container).toHaveTextContent('未設定 ・ 枠 2,000 分');
    expect(fill(container)).toBeNull();
  });
});
