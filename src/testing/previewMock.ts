// 静的プレビュー（GitHub Pages）かどうかをテストの途中で切り替えるための '@/lib/preview' の代わり。
// 使い方:
//   vi.mock('@/lib/preview', () => import('@/testing/previewMock').then((m) => m.previewModule));
//   setPreview(true);
// 描画時に読む箇所にはすぐ反映される。モジュールの読み込み時に読む箇所は vi.resetModules で読み直す
// （値は globalThis に置くので、読み直しても引き継がれる）
import { afterEach } from 'vitest';

const g = globalThis as { __staticPreview?: boolean };

export const setPreview = (on: boolean) => {
  g.__staticPreview = on;
};

afterEach(() => {
  setPreview(false);
});

export const previewModule = {
  get IS_STATIC_PREVIEW() {
    return g.__staticPreview === true;
  },
  asset: (path: string) => `/base/${path.replace(/^\//, '')}`,
};
