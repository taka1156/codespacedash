import { type FormEvent, useId, useState } from 'react';
import { useRepoCandidates } from '@/hooks/usePulls';
import { MAX_FAVORITES, normalizeRepo } from '../../../shared/repos';
import {
  control,
  favAdd,
  favError,
  favItem,
  favList,
  favName,
  group,
  iconBtn,
  legend,
  rowHint,
  smallBtn,
} from './style.css';

interface Props {
  favorites: string[];
  onChange: (favorites: string[]) => void;
}

/** 設定の「お気に入り」タブ：PR タブに出すリポジトリを登録する */
export const FavoritesTab = ({ favorites, onChange }: Props) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { repos: candidates, error: candidatesError } = useRepoCandidates(true);
  const listId = useId();

  const has = (repo: string) =>
    favorites.some((f) => f.toLowerCase() === repo.toLowerCase());
  const full = favorites.length >= MAX_FAVORITES;

  const add = (e: FormEvent) => {
    e.preventDefault();
    const repo = normalizeRepo(input);
    if (!repo) {
      setError('owner/repo の形で入力してください');
      return;
    }
    if (has(repo)) {
      setError(`${repo} は登録済みです`);
      return;
    }
    onChange([...favorites, repo]);
    setInput('');
    setError(null);
  };

  const move = (i: number, d: -1 | 1) => {
    const next = [...favorites];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div className={group}>
      <p className={legend}>
        PR タブに出すリポジトリ
        <span className={rowHint}>
          この端末だけに保存されます（{favorites.length} / {MAX_FAVORITES}）
        </span>
      </p>
      <form className={favAdd} onSubmit={add}>
        <input
          aria-label="追加するリポジトリ"
          className={control}
          list={listId}
          placeholder="owner/repo または URL"
          autoComplete="off"
          value={input}
          disabled={full}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
        />
        <datalist id={listId}>
          {(candidates ?? [])
            .filter((c) => !has(c))
            .map((c) => (
              <option key={c} value={c} />
            ))}
        </datalist>
        <button
          type="submit"
          className={smallBtn}
          disabled={full || input.trim() === ''}
        >
          追加
        </button>
      </form>
      {error && (
        <p className={favError} role="alert">
          {error}
        </p>
      )}
      {full && (
        <p className={rowHint}>登録できるのは {MAX_FAVORITES} 件までです</p>
      )}
      {candidatesError && (
        <p className={rowHint}>
          候補を取得できませんでした（{candidatesError}）。直接入力できます
        </p>
      )}
      {favorites.length === 0 ? (
        <p className={rowHint}>まだ登録がありません</p>
      ) : (
        <ul className={favList} aria-label="登録済みのリポジトリ">
          {favorites.map((f, i) => (
            <li key={f} className={favItem}>
              <span className={favName}>{f}</span>
              <button
                type="button"
                className={iconBtn}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label={`${f} を上へ`}
              >
                ↑
              </button>
              <button
                type="button"
                className={iconBtn}
                disabled={i === favorites.length - 1}
                onClick={() => move(i, 1)}
                aria-label={`${f} を下へ`}
              >
                ↓
              </button>
              <button
                type="button"
                className={iconBtn}
                onClick={() => onChange(favorites.filter((x) => x !== f))}
                aria-label={`${f} を削除`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
