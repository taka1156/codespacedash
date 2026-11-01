<img src="public/logo.svg" alt="codespacedash" width="100%" height="100%">

GitHub Codespaces・Actions・Copilot の利用状況を可視化するダッシュボード。
Codespaces の消し忘れを PWA のプッシュ通知で知らせます。

## 構成

```
ブラウザ / PWA ──(Cloudflare Access)──▶ Cloudflare Worker
  React: 整形済み JSON を表示するだけ        ├ 静的配信: React のビルド成果物
  Service Worker: 通知の表示だけ             ├ Hono /api/*: GITHUB_TOKEN で GitHub API を呼ぶ
                                             ├ Cron (15分ごと): 消し忘れ検知 → Web Push
                                             └ KV: プッシュ購読・通知済みフラグ
```

- **トークンはブラウザに一切渡りません。** Worker の Secret（`GITHUB_TOKEN`）にだけ置き、API は必要なフィールドだけに絞った JSON を返します
- 認証は Cloudflare Access が前段で行います。Worker 側でも Access の JWT（署名・`aud`・`iss`・期限）を検証し、Access を通らないリクエストは拒否します（設定がない場合はローカル以外すべて拒否）
- 状態を変える API（停止・購読登録など）はカスタムヘッダー必須で、他サイトからは呼べません
- Service Worker はキャッシュを持たないので、API の応答が端末に残りません

## ローカル開発

```bash
yarn install
cp .dev.vars.example .dev.vars   # GITHUB_TOKEN などを記入
yarn dev                         # http://localhost:5173（/api も同じオリジンで動く）
```

localhost では Access の検証をスキップします。プッシュ通知を試す場合は `.dev.vars` に VAPID 鍵も入れてください。

## デプロイ

### 1. GitHub トークン（Fine-grained PAT）

[Fine-grained token を作成](https://github.com/settings/personal-access-tokens/new)し、**Account permissions** に以下を付けます。

| 権限                                         | 用途                           |
| -------------------------------------------- | ------------------------------ |
| `Codespaces: Read`                           | Codespaces 一覧                |
| `Codespaces lifecycle admin: Read and write` | 停止ボタン（使わないなら不要） |
| `Plan: Read`                                 | Actions・Copilot の課金情報    |

**Repository access** は「All repositories」にして、**Repository permissions** に以下を付けます。

| 権限            | 用途                                                     |
| --------------- | -------------------------------------------------------- |
| `Actions: Read` | Actions 実行履歴（最近 push した15リポジトリの直近10件） |

### 2. 鍵の準備

プッシュ購読の保存先（KV）は初回デプロイ時に自動で作られるので、準備は不要です。

```bash
npx wrangler login
yarn vapid                             # VAPID 鍵を生成（Public Key と Private Key(JWK) が出力される）
```

`wrangler.jsonc` の `vars` に記入:
- `VAPID_PUBLIC_KEY`: 上で出た Public Key
- `VAPID_SUBJECT`: `mailto:自分のメールアドレス`

Secret を登録:

```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put VAPID_PRIVATE_JWK   # Private Key の JSON を1行のまま貼る
```

### 3. デプロイ

手元から:

```bash
yarn deploy
```

Cloudflare ダッシュボードの Git 連携（Workers Builds）を使う場合は、ビルド構成を以下にします。

| 項目 | 値 |
|------|------|
| ビルドコマンド | `yarn run build` |
| デプロイコマンド | `npx wrangler deploy` |
| ルートディレクトリ | `/` |

### 4. Cloudflare Access（Zero Trust）

1. Zero Trust ダッシュボード → **Access → Applications → Add an application → Self-hosted**
2. ドメインに Worker のホスト名（`codespacedash.<account>.workers.dev` またはカスタムドメイン）を指定
3. ポリシーで自分のメールアドレスだけを許可
4. **Session Duration** は長め（例: 1 month）がおすすめ。PWA で毎回ログインせずに済みます
5. 作成後に表示される **Application Audience (AUD) Tag** と、チームドメイン（`<team>.cloudflareaccess.com`）を `wrangler.jsonc` の `ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` に記入して、もう一度 `yarn deploy`

> `ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` を設定するまで、API はローカル以外すべて 500 を返します（設定漏れで公開されないための挙動です）。

### 5. 通知を有効にする

- **Android / PC**: ダッシュボード右上の「🔕 通知を有効化」を押して許可 →「テスト通知」で確認
- **iPhone / iPad**（iOS 16.4 以降）: Safari の「共有 → ホーム画面に追加」で追加したアプリを開いてから「通知を有効化」。Safari のタブのままでは通知できません

## 通知の設定

`wrangler.jsonc` で変更できます。

| 項目               | 既定           | 内容                                    |
| ------------------ | -------------- | --------------------------------------- |
| `NOTIFY_AFTER_MIN` | `60`           | 最終使用からこの分数以上 起動中なら通知 |
| `REMIND_EVERY_MIN` | `60`           | 同じ Codespace を再通知する間隔         |
| `triggers.crons`   | `*/15 * * * *` | チェック頻度（UTC）                     |
| `TIMEZONE`         | `Asia/Tokyo`   | 課金集計の「今月」の基準                |

Cron と KV は Workers の無料枠で収まります。GitHub Actions の実行時間は使いません。
