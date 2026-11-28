import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ServiceIssue } from '@/lib/types';
import {
  IssueStrips,
  OutageHint,
  ScopedIssueStrips,
  StatusScope,
} from './ServiceStatus';
import { stripSevere } from './style.css';

const actions: ServiceIssue = {
  component: 'Actions',
  status: 'degraded_performance',
  incidents: [
    { id: 'i1', name: 'Delays in Actions', url: 'https://stspg.io/i1' },
    { id: 'i2', name: 'Queued jobs', url: 'https://stspg.io/i2' },
  ],
};
const api: ServiceIssue = {
  component: 'API Requests',
  status: 'major_outage',
  incidents: [],
};

describe('IssueStrips', () => {
  it('障害がなければ何も出さない', () => {
    const { container } = render(<IssueStrips service="github" issues={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('状態名は日本語、タイトルは英語のまま並べ、最初の障害のページへリンクする', () => {
    render(<IssueStrips service="github" issues={[actions]} />);
    const strip = screen.getByRole('status');
    expect(strip).toHaveTextContent(
      '性能低下：Actions — Delays in Actions — Queued jobs GitHub Status ↗',
    );
    expect(strip).not.toHaveClass(stripSevere);
    const link = screen.getByRole('link', { name: 'GitHub Status ↗' });
    expect(link).toHaveAttribute('href', 'https://stspg.io/i1');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('一部・全面障害は赤で、障害のページがなければステータスページへ', () => {
    render(
      <IssueStrips
        service="cloudflare"
        issues={[{ ...api, component: 'API' }]}
      />,
    );
    expect(screen.getByRole('status')).toHaveClass(stripSevere);
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://www.cloudflarestatus.com',
    );
  });
});

describe('StatusScope', () => {
  it('範囲の外では帯もヒントも出さない', () => {
    const { container } = render(
      <>
        <ScopedIssueStrips />
        <OutageHint />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('パネルには自分のコンポーネントの帯だけを出す', () => {
    render(
      <StatusScope service="github" issues={[actions]} common={[api]}>
        <ScopedIssueStrips />
      </StatusScope>,
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Actions');
  });

  it('取得エラーのヒントには共通の障害も含める', () => {
    render(
      <StatusScope service="github" issues={[actions]} common={[api]}>
        <OutageHint />
      </StatusScope>,
    );
    expect(
      screen.getByText(/GitHub 側で障害が発生中です（API Requests・Actions）/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '↗' })).toHaveAttribute(
      'href',
      'https://www.githubstatus.com',
    );
  });

  it('障害がなければヒントは出さない', () => {
    const { container } = render(
      <StatusScope service="cloudflare" issues={[]} common={[]}>
        <OutageHint />
      </StatusScope>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
