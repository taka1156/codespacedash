# CLAUDE.md

QuotaDash（GitHub・Cloudflare の利用枠ダッシュボード）で作業するときのルール。構成や画面の説明は README.md を参照。

## ブランチ運用

- **`develop` が中心**。作業ブランチは必ず `develop` から切り、PR も `develop` 向けに作る（GitHub の既定ブランチは `master` なので、PR の base を必ず `develop` にする）
- 作業ブランチの名前は `feat/…` `fix/…` `chore/…` `docs/…` `test/…` など
- `master` は本番。**直接触らない**（作業ブランチを切らない・push しない・PR を向けない）。push すると GitHub Pages の静的プレビューがデプロイされる
- `develop` から `master` へのリリースはオーナーが行う
- Renovate も `develop` を基準に動く（`renovate.jsonc` の `baseBranchPatterns`）
- コミットメッセージは `feat: 〜` `fix: 〜` `chore: 〜` の形で、本文は日本語。目的の違う変更（設定変更と機能追加など）はコミットを分ける

## よく使うコマンド

```bash
yarn install --frozen-lockfile   # Yarn 1（packageManager で固定）。Node は .node-version（24）
yarn dev                         # http://localhost:5173（/api も同じオリジンで動く）
yarn dev:pages                   # 静的プレビュー（疑似データ）
yarn lint                        # Biome（lint + フォーマットのチェック）
yarn lint:fix                    # Biome で自動修正（フォーマット・import の並び替えも）
yarn typecheck                   # tsc（クライアントと Worker の両方）
yarn test                        # Vitest
yarn test:coverage               # カバレッジ付き（C0〜C2 のどれかが 100% 未満なら失敗）
yarn build && yarn build:pages   # Worker 用と静的プレビュー用のビルド
```

CI（`.github/workflows/test.yml`）は PR ごとに `yarn lint` → `yarn typecheck` → `yarn test:coverage` を実行する。**コミット前に同じ3つを手元で通すこと。**

## Lint・フォーマッター

- ESLint / Prettier は使わず、**Biome だけ**で lint とフォーマットを行う（設定は `biome.json`）
- フォーマット: スペースインデント、LF、1行80文字、シングルクォート、セミコロンあり、アロー関数の引数は常にかっこ付き
- import の並び替え（organizeImports）も Biome が行う。手で並べず `yarn lint:fix` に任せる
- `if` などは必ずブロック `{}` を付ける（`useBlockStatements`）。テンプレート文字列を使う（`useTemplate`）
- `*.md` と `*.yml` / `*.yaml` は Biome の対象外
- 警告（`noExplicitAny`・`noNonNullAssertion` など）も基本は出さない書き方にする

## テスト

- テストは Vitest。2つのプロジェクトに分かれている（`vitest.config.ts`）
  - `server`: `server/**/*.test.ts`・`shared/**/*.test.ts`（Node 環境）
  - `client`: `src/**/*.test.{ts,tsx}`・`public/**/*.test.ts`（jsdom、Testing Library）
- テストファイルは対象と同じ場所に `*.test.ts(x)` で置く。テスト名は日本語で、何を確かめるかを書く
- **カバレッジは命令（C0）・分岐（C1）・条件（C2）の 100% を保つ**。コードを足したら、`&&` / `||` / `??` / 三項演算子の各条件が真と偽の両方になるテストも足す
  - C0・C1 は istanbul の閾値で、C2 は `scripts/check-condition-coverage.mjs` で確かめる
  - 対象外は `*.css.ts`（vanilla-extract）・`src/lib/types.ts`・`testing/` だけ。カバレッジを除外する設定やコメントで逃げない
- 共通の道具
  - クライアントの疑似データ: `src/testing/fixtures.ts`（`dashboard()`・`NOW` など。時刻は `vi.useFakeTimers({ now: NOW })` で固定する）
  - Worker の疑似環境: `server/testing/fakeEnv.ts`（`fakeEnv()`・`fakeKv()`・`json()`）
  - 静的プレビューの切り替え: `src/testing/previewMock.ts`（`setPreview(true)`）
- 外部 API（GitHub・Cloudflare）には実際にアクセスしない。`fetch` を `vi.stubGlobal` で差し替える

## 実装のメモ

- `DashboardResponse` など API の型は `shared/types.ts` にまとめ、サーバーとクライアントで共有する。項目を足したら `src/testing/fixtures.ts` と `src/lib/debug.ts`（静的プレビューの疑似データ）も更新する
- 取得は項目ごとに `SectionState`（ok / unconfigured / forbidden / error）で返し、1つ失敗してもほかは表示する
- トークンはブラウザに渡さない。Worker のシークレットにだけ置き、API は必要なフィールドだけに絞って返す
- スタイルは vanilla-extract（`*.css.ts`）。色などは `src/styles.css` の CSS 変数を使う
