import { footer, footerLink } from './style.css';

export const REPOSITORY_URL = 'https://github.com/taka1156/quotadash';

/** ページの一番下に出すフッター（コピーライトとリポジトリへのリンク） */
export const Footer = () => (
  <footer className={footer}>
    <span>© 2026 taka1156</span>
    <a
      className={footerLink}
      href={REPOSITORY_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      GitHub ↗
    </a>
  </footer>
);
