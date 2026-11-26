<img src="public/logo.svg" alt="codespacedash" width="100%" height="100%">

GitHub Codespaces・Actions・Copilot（または Claude）と Cloudflare Workers Builds の利用状況を可視化するダッシュボード。
Codespaces の消し忘れを PWA のプッシュ通知で知らせます。

## 構成

```
ブラウザ / PWA ──(Cloudflare Access)──▶ Cloudflare Worker
  React: 整形済み JSON を表示するだけ        ├ 静的配信: React のビルド成果物
  Service Worker: 通知の表示だけ             ├ Hono /api/*: GITHUB_TOKEN で GitHub API を呼ぶ
                                             │   （設定があれば CLOUDFLARE_API_TOKEN で Workers Builds も）
                                             ├ Cron (15分ごと): 消し忘れ検知 → Web Push
                                             └ KV: プッシュ購読・通知済みフラグ
```

- **トークンはブラウザに一切渡りません。** Worker の Secret（`GITHUB_TOKEN` など）にだけ置き、API は必要なフィールドだけに絞った JSON を返します
- 認証は Cloudflare Access が前段で行います。Worker 側でも Access の JWT（署名・`aud`・`iss`・期限）を検証し、Access を通らないリクエストは拒否します（設定がない場合はローカル以外すべて拒否）
- 状態を変える API（停止・購読登録など）はカスタムヘッダー必須で、他サイトからは呼べません
- Service Worker はキャッシュを持たないので、API の応答が端末に残りません

## ローカル開発

```bash
yarn install
cp .dev.vars.example .dev.vars   # GITHUB_TOKEN などを記入
yarn dev                         # http://localhost:5173（/api も同じオリジンで動く）
yarn test                        # Vitest（集計・プラン判定などの関数のテスト）
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

### 2. Cloudflare API トークン（Workers Builds を使う場合のみ）

Actions / Workers のタブで Workers Builds（Git 連携した Worker のビルド）を表示するのに使います。使わない場合はこの手順を飛ばしてください。Workers タブには「未設定」と表示されるだけで、ほかの表示には影響しません。

[My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens) で **ユーザー単位の** トークンを作成し、以下の権限を付けます。

| 権限 | 用途 |
| --- | --- |
| `Workers Builds Configuration: Read` | ビルド履歴・ビルド時間の上限の取得 |
| `Workers Scripts: Read` | Worker の一覧（ビルド履歴の取得に Worker の tag が必要） |

> **アカウント単位のトークン（Manage Account → Account API Tokens）は使えません。** Builds API はユーザー単位のトークンしか受け付けず、`Invalid token` エラーになります。
> Read で 403 になる場合は `Workers Builds Configuration` を Edit にしてください（公式ガイドは Edit で案内しています）。

アカウント ID は Cloudflare ダッシュボードの **Workers & Pages** の概要ページ右側、または URL の `dash.cloudflare.com/<アカウントID>/…` で確認できます。

### 3. 鍵の準備

プッシュ購読の保存先（KV）は初回デプロイ時に自動で作られるので、準備は不要です。

```bash
npx wrangler login
yarn vapid                             # VAPID 鍵を生成（Public Key と Private Key(JWK) が出力される）
```

Cloudflare ダッシュボードの Worker の **設定 → 変数とシークレット** に追加します（`wrangler.jsonc` には書きません。`keep_vars: true` なのでデプロイしても消えません）。

| 名前 | 種類 | 値 |
|------|------|------|
| `GITHUB_TOKEN` | シークレット | 手順1で作ったトークン |
| `CLOUDFLARE_API_TOKEN` | シークレット | Workers Builds を使う場合のみ。手順2で作ったトークン |
| `CLOUDFLARE_ACCOUNT_ID` | テキスト | Workers Builds を使う場合のみ。Cloudflare のアカウント ID |
| `ANTHROPIC_ADMIN_KEY` | シークレット | Claude を「API 従量課金」で使う場合のみ。Anthropic の Admin API キー（`sk-ant-admin01-…`）。Pro / Max では不要 |
| `VAPID_PRIVATE_JWK` | シークレット | 上で出た Private Key の JSON（1行のまま） |
| `VAPID_PUBLIC_KEY` | テキスト | 上で出た Public Key |
| `VAPID_SUBJECT` | テキスト | `https://自分のサイト` か `mailto:メールアドレス`（プッシュ配信サービス向けの連絡先。端末には表示されません） |

### 4. デプロイ

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

Yarn は `package.json` の `packageManager`（`yarn@1.22.22`）、Node.js は `.node-version`（24）で固定しています。Workers Builds の既定は Yarn 4 で、Yarn 1 形式の `yarn.lock` だとインストールで失敗するため、この指定は消さないでください。

### 5. Cloudflare Access（Zero Trust）

1. Zero Trust ダッシュボード → **Access → Applications → Add an application → Self-hosted**
2. ドメインに Worker のホスト名（`codespacedash.<account>.workers.dev` またはカスタムドメイン）を指定
3. ポリシーで自分のメールアドレスだけを許可
4. **Session Duration** は長め（例: 1 month）がおすすめ。PWA で毎回ログインせずに済みます
5. 作成後に表示される **Application Audience (AUD) Tag** を `ACCESS_AUD`、チームドメイン（`<team>.cloudflareaccess.com`）を `ACCESS_TEAM_DOMAIN` として、変数とシークレットに追加（テキスト）

> `ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` を設定するまで、API はローカル以外すべて 500 を返します（設定漏れで公開されないための挙動です）。

### 6. 通知を有効にする

- **Android / PC**: ダッシュボード右上の「🔕 通知を有効化」を押して許可 →「テスト通知」で確認
- **iPhone / iPad**（iOS 16.4 以降）: Safari の「共有 → ホーム画面に追加」で追加したアプリを開いてから「通知を有効化」。Safari のタブのままでは通知できません

## 画面の設定（⚙ ボタン）

設定は端末ごと（ブラウザの localStorage）に保存されます。

**設定タブ**

- **AIパネル**: Copilot と Claude のどちらを表示するか。選ばれていない方の API は呼びません
- **契約プラン**: 無料枠・上限の計算に使います

| サービス | プラン | 上限 | 判定 |
|---|---|---|---|
| GitHub | Free / Pro | Codespaces 120 / 180 コア時間・ストレージ 15 / 20 GB-月、Actions 2,000 / 3,000 分 | `GET /user` の `plan` から自動（手動で変更も可） |
| Cloudflare Workers | Free / Paid | Workers Builds のビルド時間 3,000 / 6,000 分 | Builds API の account limits から推定（手動で変更も可） |
| Copilot | Free / Pro / Pro+ | AI Credits 付与額 なし / $10 / $39 | 手動（API なし） |
| Claude | Pro / Max 5x / Max 20x / API | 月額 $20 / $100 / $200 / 従量 | 手動（API なし） |

> Claude のサブスク（Pro / Max）の使用量を取れる公式 API はないため、Pro / Max を選ぶと Claude パネルはプラン情報と claude.ai の使用量ページへのリンクだけを表示します（API は呼びません。`claude setup-token` のトークンは使用量の取得には使えません）。
> 「API 従量課金」を選んだ場合は、Admin API で取れるトークン数・費用を表示します。Admin API は Console の組織アカウントでのみ使え、`ANTHROPIC_ADMIN_KEY` が必要です。

> Workers Builds のビルド時間の使用量を返す API はないため、今期のビルドの所要時間（1分単位で切り上げ）を合計した推定値です。集計期間は Free ならビルド時間のリセット日から1か月前まで、Paid なら `TIMEZONE` 基準の今月です。プランの自動判定は、account limits の応答にリセット日か上限フラグがあれば Free（この2項目は Free プランでだけ返る）、なければ Paid とみなします。

上限値は `src/lib/plans.ts` にまとめてあります。

**デバッグタブ**

デバッグモードをオンにすると、ロゴの横に `DEBUG` が表示され、使用量（Codespaces・Actions・Workers Builds・Copilot・Claude）とプランを疑似値で上書きできます。差し替えはブラウザ内だけで行い、サーバーには影響しません。API が使えない環境でも疑似データで表示できます。

## 通知の設定

`wrangler.jsonc` で変更できます。

| 項目               | 既定           | 内容                                    |
| ------------------ | -------------- | --------------------------------------- |
| `NOTIFY_AFTER_MIN` | `60`           | 最終使用からこの分数以上 起動中なら通知 |
| `REMIND_EVERY_MIN` | `60`           | 同じ Codespace を再通知する間隔         |
| `triggers.crons`   | `*/15 * * * *` | チェック頻度（UTC）                     |
| `TIMEZONE`         | `Asia/Tokyo`   | 課金集計の「今月」の基準                |

Cron と KV は Workers の無料枠で収まります。GitHub Actions の実行時間は使いません。
