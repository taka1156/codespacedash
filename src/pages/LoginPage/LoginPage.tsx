import clsx from 'clsx';
import { useEffect, useState } from 'react';
import {
  btnSpinner,
  loginBtn,
  loginBtnLoading,
  loginCard,
  loginCardMounted,
  loginError,
  loginLogo,
  loginLogoImg,
  loginNotice,
  loginRoot,
  loginSub,
  loginTitle,
  patField,
  patHint,
  patInput,
  patInputWrap,
  patLabel,
  patToggle,
  scopeItem,
  scopeLink,
  scopeList,
  scopeSection,
  scopeTitle,
} from './style.css';

interface Props {
  onLogin: (pat: string) => void;
  loading: boolean;
  errorMsg: string | null;
}

export const LoginPage = ({ onLogin, loading, errorMsg }: Props) => {
  const [pat, setPat] = useState('');
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 40);
  }, []);

  const handleSubmit = () => {
    const trimmed = pat.trim();
    if (!trimmed) {
      return;
    }
    onLogin(trimmed);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const isValid =
    pat.trim().startsWith('ghp_') || pat.trim().startsWith('github_pat_');
  const isFineGrained = pat.trim().startsWith('github_pat_');

  return (
    <div className={loginRoot}>
      <div className={clsx(loginCard, mounted && loginCardMounted)}>
        <div className={loginLogo}>
          <img
            className={loginLogoImg}
            src="./src/assets/logo.svg"
            alt="CodespaceDash"
          />
        </div>

        <h1 className={loginTitle}>GitHub Dashboard</h1>
        <p className={loginSub}>Codespaces · Actions · Copilot</p>

        {errorMsg && <div className={loginError}>⚠️ {errorMsg}</div>}

        <div className={patField}>
          <label htmlFor="patInput" className={patLabel}>
            Personal Access Token
          </label>
          <div className={patInputWrap}>
            <input
              id="patInput"
              className={patInput}
              type={show ? 'text' : 'password'}
              placeholder="ghp_xxxxxxxxxxxx"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              onKeyDown={handleKey}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className={patToggle}
              onClick={() => setShow((s) => !s)}
              tabIndex={-1}
            >
              {show ? '🙈' : '👁'}
            </button>
          </div>
          {pat.length > 4 && !isValid && (
            <p className={patHint}>
              ghp_ または github_pat_ で始まるトークンを入力してください
            </p>
          )}
          {isValid && !isFineGrained && (
            <p className={patHint} style={{ color: 'var(--yellow)' }}>
              ⚠️ Classic PAT はCodespaces一覧のみ表示されます。課金情報には
              Fine-grained PAT を推奨します
            </p>
          )}
        </div>

        <button
          type="button"
          className={`${loginBtn} ${loading ? loginBtnLoading : ''}`}
          onClick={handleSubmit}
          disabled={loading || !pat.trim()}
        >
          {loading ? <span className={btnSpinner} /> : null}
          {loading ? '認証中...' : 'ダッシュボードを開く'}
        </button>

        {/* Scope list */}
        <div className={scopeSection}>
          <p className={scopeTitle}>Fine-grained PAT（推奨）に必要な権限</p>
          <ul className={scopeList}>
            <li className={scopeItem}>
              <code>Account: Plan (read)</code>
              <span>Actions・Copilot課金情報</span>
            </li>
            <li className={scopeItem}>
              <code>Account: Codespaces (read)</code>
              <span>Codespaces 一覧</span>
            </li>
          </ul>
          <a
            className={scopeLink}
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            ↗ Fine-grained PAT を作成する（推奨）
          </a>
          <div style={{ marginTop: 8 }}>
            <a
              className={scopeLink}
              style={{ opacity: 0.6, fontSize: '0.72rem' }}
              href="https://github.com/settings/tokens/new?scopes=read:user,codespace&description=GitHub+Dashboard"
              target="_blank"
              rel="noopener noreferrer"
            >
              ↗ Classic PAT（Codespaces一覧のみ表示）
            </a>
          </div>
        </div>

        <p className={loginNotice}>
          🔒
          トークンはブラウザのメモリのみに保存され、サーバーには送信されません
        </p>
      </div>
    </div>
  );
};
