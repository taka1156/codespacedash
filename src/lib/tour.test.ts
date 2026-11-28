import { driver } from 'driver.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startTour, tourSteps, tourTarget } from './tour';
import { tourPopover } from './tour.css';

vi.mock('driver.js', () => ({
  driver: vi.fn(() => ({ drive: vi.fn() })),
}));

/** ツアーで指す要素を並べる（panels は子の数だけパネルを置く） */
const mount = (targets: string[], panels = 0) => {
  document.body.innerHTML = targets
    .map((t) =>
      t === 'panels'
        ? `<div data-tour="panels">${'<section></section>'.repeat(panels)}</div>`
        : `<div data-tour="${t}"></div>`,
    )
    .join('');
};

const ALL = ['tabs', 'panels', 'refresh', 'settings', 'help'];
const titles = (tab: Parameters<typeof tourSteps>[0]) =>
  tourSteps(tab).map((s) => s.popover?.title);

beforeEach(() => {
  document.body.innerHTML = '';
  vi.mocked(driver).mockClear();
});

describe('tourTarget', () => {
  it('data-tour の属性セレクター', () => {
    expect(tourTarget('help')).toBe('[data-tour="help"]');
  });
});

describe('tourSteps', () => {
  it('GitHub タブはタブ → 3つのパネル → 共通の順', () => {
    mount(ALL, 3);
    expect(titles('github')).toEqual([
      'サービスの切り替え',
      'Codespaces',
      'Actions',
      'Copilot',
      '更新',
      '設定',
      '使い方',
    ]);
  });

  it('Cloudflare タブは Cloudflare のパネルを案内する', () => {
    mount(ALL, 3);
    expect(titles('cloudflare').slice(1, 4)).toEqual([
      'Workers Builds',
      '日次の無料枠',
      'ストレージ・月次',
    ]);
  });

  it('PR タブはパネル1つ', () => {
    mount(ALL, 1);
    expect(titles('pulls')).toHaveLength(5);
    expect(titles('pulls')[1]).toBe('オープンな PR');
  });

  it('パネルは左から順に指す', () => {
    mount(ALL, 3);
    const steps = tourSteps('github');
    expect(steps[1].element).toBe('[data-tour="panels"] > :nth-child(1)');
    expect(steps[3].element).toBe('[data-tour="panels"] > :nth-child(3)');
  });

  it('画面にない要素（読み込み中のパネルなど）は飛ばす', () => {
    mount(['tabs', 'refresh', 'settings', 'help']);
    expect(titles('github')).toEqual([
      'サービスの切り替え',
      '更新',
      '設定',
      '使い方',
    ]);
  });

  it('パネルが足りなければある分だけ', () => {
    mount(ALL, 2);
    expect(titles('github')).not.toContain('Copilot');
    expect(titles('github')).toContain('Actions');
  });

  it('何もなければ空', () => {
    expect(tourSteps('github')).toEqual([]);
  });

  it('説明は空でない', () => {
    mount(ALL, 3);
    for (const tab of ['github', 'cloudflare', 'pulls'] as const) {
      for (const s of tourSteps(tab)) {
        expect(s.popover?.description?.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('startTour', () => {
  it('開いているタブの手順で日本語のツアーを始める', () => {
    mount(ALL, 3);
    const tour = startTour('cloudflare');
    expect(driver).toHaveBeenCalledTimes(1);
    const config = vi.mocked(driver).mock.calls[0][0];
    expect(config?.steps).toEqual(tourSteps('cloudflare'));
    expect(config).toMatchObject({
      popoverClass: tourPopover,
      showProgress: true,
      progressText: '{{current}} / {{total}}',
      nextBtnText: '次へ',
      prevBtnText: '戻る',
      doneBtnText: '完了',
      closeBtnLabel: '閉じる',
    });
    expect(tour.drive).toHaveBeenCalledWith();
  });
});
