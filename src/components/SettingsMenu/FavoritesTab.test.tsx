import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRepoCandidates } from '@/hooks/usePulls';
import { FavoritesTab } from './FavoritesTab';

vi.mock('@/hooks/usePulls', () => ({ useRepoCandidates: vi.fn() }));

const candidates = (
  repos: string[] | null = ['me/app', 'me/new', 'org/lib'],
  error: string | null = null,
) => vi.mocked(useRepoCandidates).mockReturnValue({ repos, error });

const tab = (favorites: string[] = []) => {
  const onChange = vi.fn();
  render(<FavoritesTab favorites={favorites} onChange={onChange} />);
  return { onChange };
};

const input = () =>
  screen.getByRole('combobox', { name: '追加するリポジトリ' });
const addBtn = () => screen.getByRole('button', { name: '追加' });
const type = (v: string) => fireEvent.change(input(), { target: { value: v } });

beforeEach(() => {
  candidates();
});

describe('FavoritesTab', () => {
  it('登録がなければその旨を出し、件数と上限を出す', () => {
    tab();
    expect(screen.getByText('まだ登録がありません')).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 30/)).toBeInTheDocument();
    expect(useRepoCandidates).toHaveBeenCalledWith(true);
  });

  it('候補は登録済みを除いて出す', () => {
    const { container } = render(
      <FavoritesTab favorites={['ME/APP']} onChange={vi.fn()} />,
    );
    const options = [...container.querySelectorAll('datalist option')].map(
      (o) => o.getAttribute('value'),
    );
    expect(options).toEqual(['me/new', 'org/lib']);
  });

  it('候補が取れていなくても入力できる', () => {
    candidates(null, '権限不足（Metadata: Read）');
    const { container } = render(
      <FavoritesTab favorites={[]} onChange={vi.fn()} />,
    );
    expect(container.querySelectorAll('datalist option')).toHaveLength(0);
    expect(
      screen.getByText(/候補を取得できませんでした（権限不足/),
    ).toBeInTheDocument();
    expect(input()).toBeEnabled();
  });

  it('入力を owner/repo にそろえて末尾に足し、入力を空にする', () => {
    const { onChange } = tab(['me/app']);
    expect(addBtn()).toBeDisabled();
    type(' https://github.com/org/lib/pulls ');
    expect(addBtn()).toBeEnabled();
    fireEvent.click(addBtn());
    expect(onChange).toHaveBeenCalledWith(['me/app', 'org/lib']);
    expect(input()).toHaveValue('');
  });

  it('形が違う・登録済みならエラーを出し、入力し直すと消す', () => {
    const { onChange } = tab(['me/app']);
    type('not-a-repo');
    fireEvent.submit(input());
    expect(screen.getByRole('alert')).toHaveTextContent(
      'owner/repo の形で入力してください',
    );

    type('Me/App');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.submit(input());
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Me/App は登録済みです',
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('上限まで登録したら追加できない', () => {
    tab(Array.from({ length: 30 }, (_, i) => `me/r${i}`));
    expect(input()).toBeDisabled();
    type('me/app');
    expect(addBtn()).toBeDisabled();
    expect(
      screen.getByText('登録できるのは 30 件までです'),
    ).toBeInTheDocument();
  });

  it('並べ替えと削除ができる（端では動かせない）', () => {
    const { onChange } = tab(['a/1', 'b/2', 'c/3']);
    expect(screen.getByRole('button', { name: 'a/1 を上へ' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'c/3 を下へ' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'b/2 を上へ' }));
    expect(onChange).toHaveBeenLastCalledWith(['b/2', 'a/1', 'c/3']);
    fireEvent.click(screen.getByRole('button', { name: 'b/2 を下へ' }));
    expect(onChange).toHaveBeenLastCalledWith(['a/1', 'c/3', 'b/2']);
    fireEvent.click(screen.getByRole('button', { name: 'b/2 を削除' }));
    expect(onChange).toHaveBeenLastCalledWith(['a/1', 'c/3']);
  });

  it('登録済みの一覧に名前を出す', async () => {
    tab(['me/app']);
    await act(async () => {});
    expect(
      screen.getByRole('list', { name: '登録済みのリポジトリ' }),
    ).toHaveTextContent('me/app');
  });
});
