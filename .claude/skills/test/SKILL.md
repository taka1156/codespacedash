---
name: test
description: QuotaDash でテストを書く・直す・カバレッジ（C0〜C2 100%）を満たすときの手順。コードを足したり変えたりしたとき、yarn test:coverage が落ちたとき、「テストを書いて」「カバレッジを上げて」と言われたときに使う。
---

# QuotaDash のテスト

このリポジトリは **命令（C0）・分岐（C1）・条件（C2）のカバレッジ 100%** を CI で必須にしている。コードを足したら、同じ PR でテストも足す。

## 1. 流れ

1. 変更したファイルの隣にある `*.test.ts(x)` を開き、書き方（疑似データ・モックの作り方）を真似る。なければ同じ場所に新しく作る
2. まず対象のテストだけ回す
   ```bash
   yarn vitest run path/to/file.test.ts         # 1ファイル
   yarn vitest run --project server             # Worker 側だけ
   yarn vitest run --project client             # 画面側だけ
   ```
3. 最後に全体を CI と同じ順で通す
   ```bash
   yarn lint && yarn typecheck && yarn test:coverage
   ```
4. `test:coverage` が落ちたら「4. カバレッジが足りないとき」の手順で直す

## 2. どこに何を書くか

| 対象 | プロジェクト | 環境 | 置き場所 |
|---|---|---|---|
| Worker（Hono）・`server/lib/*` | `server` | node | `server/**/*.test.ts` |
| 共有の関数（`shared/*`） | `server` | node | `shared/**/*.test.ts` |
| 画面・hooks・`src/lib/*` | `client` | jsdom | `src/**/*.test.{ts,tsx}` |
| Service Worker（`public/sw.js`） | `client` | jsdom | `public/sw.test.ts` |

- テスト名は日本語で、**何を確かめるか**を書く（例: `'期限が近ければ日数と再発行のリンク'`）
- カバレッジの対象外は `*.css.ts`・`src/lib/types.ts`・`testing/` だけ。`/* istanbul ignore */` や `vitest.config.ts` の `exclude` 追加で逃げない

## 3. 道具とよく使う書き方

### 共通の疑似データ・環境

- `src/testing/fixtures.ts` … `dashboard({...})`（`DashboardResponse` の既定値。必要な項目だけ上書き）、`NOW`、`ago(分)`、`build()` など
- `server/testing/fakeEnv.ts` … `fakeEnv({...})`（Worker の `Env`）、`fakeKv()`（`puts` に書き込みが残る）、`json(body)`、`PUSH_VARS`（プッシュ通知を有効にする変数）
- `src/testing/previewMock.ts` … 静的プレビューの切り替え。テストファイルの先頭で
  ```ts
  vi.mock('@/lib/preview', () =>
    import('@/testing/previewMock').then((m) => m.previewModule),
  );
  ```
  とし、プレビュー側を確かめるテストで `setPreview(true)` を呼ぶ
- `src/testing/setup.ts` が各テストの後に `cleanup`・`vi.restoreAllMocks()`・`vi.unstubAllGlobals()`・`vi.useRealTimers()`・`localStorage.clear()` を行う。自分で戻す必要はない

### 時刻

- 時刻に依存するテストは `vi.useFakeTimers({ now: NOW, toFake: ['Date'] })` で固定する。`toFake: ['Date']` にしておくと `setTimeout` や Promise は普通に動く
- 「あと N 日」のような値は `NOW` からの相対で作る（`new Date(NOW.getTime() + n * 86_400_000).toISOString()`）

### 外部 API（GitHub・Cloudflare など）

- 実際にはアクセスしない。`vi.stubGlobal('fetch', fetchMock)` で差し替え、パスごとに応答を返す（`server/lib/cloudflare.test.ts` の `routes()` が見本）
- モジュール内にキャッシュを持つもの（`getUser`・`getWorkersBuilds` など）は、`beforeEach` で `vi.resetModules()` し、`const load = () => import('./xxx')` で毎回読み直す
- 上位の処理（`server/index.ts` など）のテストでは、下位の関数を `vi.mock('./lib/github', ...)` でまるごと差し替え、`vi.mocked(fn).mockResolvedValue(...)` で結果を決める

### 画面（React）

- Testing Library の `render`・`screen`・`fireEvent`・`within` を使い、ロールと名前で探す（`getByRole('tab', { name: 'トークン' })`）。クラス名で探さない
- 見た目の状態は、そのコンポーネントの `style.css.ts` から import したクラス名で確かめる（`toHaveClass(pillLevel.warn)`）
- hooks を差し替えるときは `vi.mock('@/hooks/usePush', () => ({ usePush: vi.fn() }))` とし、`vi.mocked(usePush).mockReturnValue(...)` で状態を決める
- 親で状態を持つコンポーネント（`SettingsPage` など）は、テストファイルのトップレベルに小さな `Harness` を作って状態を持たせる（関数の中で定義すると Biome に怒られる）
- jsdom にないもの: `window.scrollTo` は `vi.spyOn(window, 'scrollTo').mockImplementation(() => {})`。`location` を差し替えるときは `hash: ''` などハッシュも入れる（`useRoute` が `location.hash` を読む）

## 4. カバレッジが足りないとき

`yarn test:coverage` は2段階で落ちる。

### C0・C1（istanbul の閾値）

出力の表で 100 未満のファイルと `Uncovered Line #s` を見る。詳しくは `coverage/index.html`（行ごとに赤・黄で表示）。通っていない行・分岐に入る入力を考えてテストを足す。

### C2（`scripts/check-condition-coverage.mjs`）

```
条件網羅（C2）を満たしていない条件が 2 件あります
  src/components/Settings/TokensSection.tsx:85:5 「status.level !== 'invalid'」が偽になるテストがありません
```

- `&&` / `||` / `??` の**各項**が、真と偽の両方になったかを見ている（`??` は null/undefined とそれ以外）
- いちばん右の項は、式全体が `if` や三項演算子の条件のときだけ確かめる（`a || 'fallback'` や `cond && <JSX />` の右側は値なので対象外）
- 直し方
  1. 表示されたファイル・行・項を開き、その項だけが逆になる入力を考える。`a && b` の `b` を偽にしたいなら、`a` は真のままにする
  2. `it.each` で状態ごとの表にすると、抜けがわかりやすい（`TokensSection.test.tsx`・`NotificationsSection.test.tsx` が見本）
  3. どうやっても片方にならない項は、条件が冗長なサイン。テストで無理に作らず、**コードの条件を整理する**（不要な項を消す、型で絞る、早期 return にする）

## 5. よくある落とし穴

- `DashboardResponse` などの型に項目を足したら、`src/testing/fixtures.ts`・`src/lib/debug.ts`（静的プレビューの疑似データ）・`src/lib/debug.test.ts` の `data()` も合わせて直す。直さないと型エラーかテストの失敗になる
- `useSettings` の `DebugSettings` に項目を足したら、`EMPTY_DEBUG` と `load()` の両方に入れ、`useSettings.test.ts` の保存データの往復テストにも足す
- 画面の文言を変えたら、その文言で探しているテスト（`getByText`・`getByRole` の `name`）も直す
- `console.log` / `console.error` を出す処理は、テストで `vi.spyOn(console, 'log').mockImplementation(() => {})` して出力を抑え、必要なら呼ばれたことを確かめる
- Biome の lint もテストファイルに効く。`yarn lint:fix` で整形してからコミットする
