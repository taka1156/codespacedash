<img src="public/logo.svg" alt="QuotaDash" width="100%" height="100%">

**QuotaDash** は、GitHub（Codespaces・Actions・Copilot）と Cloudflare（Workers Builds・無料枠）の利用枠をまとめて確認するダッシュボードです。
タブで切り替えて使用量と残りを可視化し、Codespaces の消し忘れは PWA のプッシュ通知で知らせます。

> 旧称 CodespaceDash。Codespaces 専用ではなくなったため改名しました。Worker 名（`codespacedash`）は互換性のためそのままです。

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
yarn test                        # Vitest（関数・API・画面のテスト）
yarn test:coverage               # カバレッジ付き。C0〜C2 のどれかが 100% を下回ると失敗する
```

テストのカバレッジは命令（C0）・分岐（C1）・条件（C2）の 100% を保っています。

- C0・C1 は istanbul で測り、`vitest.config.ts` の閾値（100%）で確かめます。`&&` / `||` / `??` の各項が評価されたかも分岐として数えます
- C2（各条件が真と偽の両方になったか）は istanbul だけでは分からないので、`scripts/check-condition-coverage.mjs` で各項の評価回数から求めて確かめます。値として使われるいちばん右の項（`a || 'fallback'` など）は、式が if・三項演算子の条件になっているときだけ対象にします
- レポートは `coverage/index.html` に出ます

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
| `Actions: Read` | Actions 実行履歴（最近 push した15リポジトリから private / public それぞれ直近10件） |
| `Pull requests: Read` | PR タブ（お気に入りリポジトリのオープンな PR） |
| `Metadata: Read` | PR タブのお気に入り登録の候補（自動で付く必須の権限） |

> PR タブは公開リポジトリなら自分のものでなくても表示できます。private リポジトリはトークンで見られるものだけです（Fine-grained PAT は自分のアカウントのリポジトリに限られます。Organization のリポジトリは Resource owner をその Organization にしたトークンが必要です）。

### 2. Cloudflare API トークン（Cloudflare タブを使う場合のみ）

Cloudflare タブで Workers Builds（Git 連携した Worker のビルド）を表示するのに使います。使わない場合はこの手順を飛ばしてください。Cloudflare タブの各パネルに「未設定」と表示されるだけで、ほかの表示には影響しません。

[My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens) で **ユーザー単位の** トークンを作成し、以下の権限を付けます。

| 権限 | 用途 |
| --- | --- |
| `Workers Builds Configuration: Read` | ビルド履歴・ビルド時間の上限の取得 |
| `Workers Scripts: Read` | Worker の一覧（ビルド履歴の取得に Worker の tag が必要） |
| `Account Analytics: Read` | 無料枠の使用量（Workers リクエスト・Workers AI・D1・KV・R2）。GraphQL Analytics API で取得 |

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
2. ドメインに Worker のカスタムドメインを指定
   - `wrangler.jsonc` で `workers_dev: false` / `preview_urls: false` にしているので、`*.workers.dev` の本番 URL とプレビュー URL では開けません。先に Worker の **設定 → ドメインとルート** でカスタムドメインを追加してください
   - workers.dev で使いたい場合は `workers_dev` を `true` にして、そのホスト名を Access に指定します
3. ポリシーで自分のメールアドレスだけを許可
4. **Session Duration** は長め（例: 1 month）がおすすめ。PWA で毎回ログインせずに済みます
5. 作成後に表示される **Application Audience (AUD) Tag** を `ACCESS_AUD`、チームドメイン（`<team>.cloudflareaccess.com`）を `ACCESS_TEAM_DOMAIN` として、変数とシークレットに追加（テキスト）

> `ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` を設定するまで、API はローカル以外すべて 500 を返します（設定漏れで公開されないための挙動です）。

### 6. 通知を有効にする

- **Android / PC**: ダッシュボード右上の「🔕 通知を有効化」を押して許可 →「テスト通知」で確認
- **iPhone / iPad**（iOS 16.4 以降）: Safari の「共有 → ホーム画面に追加」で追加したアプリを開いてから「通知を有効化」。Safari のタブのままでは通知できません

## 画面

- 上部のタブで **GitHub**（Codespaces / Actions / Copilot）、**Cloudflare**（Workers Builds / 日次の無料枠 / ストレージ・月次）、**PR**（お気に入りリポジトリのオープンな PR）を切り替えます。どちらのタブのデータも毎回取得し、見ていない側でビルドや実行が失敗していればタブに赤い点が付きます
- PC ではパネルを3列・同じ高さに固定し、中身が多いときはパネルの中でスクロールします。スマホでは1列です
- Actions の無料枠（2,000 / 3,000 分）は、公開リポジトリの実行を除いて計算します。標準ランナーでの公開リポジトリの実行は無料で、枠を消費しないためです（課金された larger runner の分は残します）。明細を取得できなかったときは公開分も含めて表示します（多めに出る＝安全側）
- Actions の実行履歴は private / public をタブで切り替えます。見ていない側で失敗していればタブに赤い点が付きます
- PR タブは、お気に入りに登録したリポジトリごとにアコーディオンでオープンな PR を出します
  - GraphQL API 1回で全リポジトリぶんを取ります（1リポジトリあたり更新が新しい順に10件。それより多いときは「ほか N 件を GitHub で見る」）
  - 番号・作成者・ブランチ・Draft・レビューの状態（承認済み / 変更依頼 / レビュー待ち）・コメント数を出します
  - 最初は PR があるリポジトリだけ開きます。「すべて開く / すべて閉じる」もあります
  - 見つからない・トークンで見られないリポジトリは「見つかりません」と出します
- 取れなかった項目も枠はそのまま出し、中身だけ「未設定」「権限不足（足りない権限名）」「取得エラー」に差し替えます
- Cloudflare タブの「日次の無料枠」「ストレージ・月次」は GraphQL Analytics API から項目ごとに取得します（1分キャッシュ）
  - 日次（00:00 UTC = 9:00 JST リセット）: Workers リクエスト、Workers AI（Neurons）、D1 の読み書き行数、KV の読み書き・削除・一覧取得の回数
  - 月次・現在量: R2 の Class A / B 操作（UTC の今月、削除などの無料操作は除く）、R2・D1・KV のストレージ量
  - 上限は Workers Free の無料枠で表示します（`src/lib/plans.ts`）。Paid では超過分が従量課金になるだけなので、目安として見てください
  - 取得できなかった項目は、パネル内にエラー文と足りない権限名を出します

## 画面の設定（⚙ ボタン）

設定は端末ごと（ブラウザの localStorage）に保存されます。

**設定タブ**

- **契約プラン**: 無料枠・上限の計算に使います

| サービス | プラン | 上限 | 判定 |
|---|---|---|---|
| GitHub | Free / Pro | Codespaces 120 / 180 コア時間・ストレージ 15 / 20 GB-月、Actions 2,000 / 3,000 分 | `GET /user` の `plan` から自動（手動で変更も可） |
| Cloudflare Workers | Free / Paid | Workers Builds のビルド時間 3,000 / 6,000 分 | Builds API の account limits から推定（手動で変更も可） |
| Copilot | Free / Pro / Pro+ | AI Credits 付与額 なし / $10 / $39 | 手動（API なし） |

> Workers Builds のビルド時間の使用量を返す API はないため、今期のビルドの所要時間（1分単位で切り上げ）を合計した推定値です。集計期間は Free ならビルド時間のリセット日から1か月前まで、Paid なら `TIMEZONE` 基準の今月です。プランの自動判定は、account limits の応答にリセット日か上限フラグがあれば Free（この2項目は Free プランでだけ返る）、なければ Paid とみなします。

上限値は `src/lib/plans.ts` にまとめてあります。

**お気に入りタブ**

PR タブに出すリポジトリを登録します（最大30件、この端末の localStorage に保存）。`owner/repo` か GitHub の URL を入力するか、候補（トークンで見られるリポジトリを最近 push した順に100件）から選びます。↑↓ で並べ替えると PR タブの並びも変わります。

**デバッグタブ**

デバッグモードをオンにすると、ロゴの横に `DEBUG` が表示され、使用量（Codespaces・Actions・Workers Builds・Copilot）とプランを疑似値で上書きできます。「取得状態を上書き」で全項目を未設定・権限不足・取得エラーにして、取れなかったときの表示も確認できます。差し替えはブラウザ内だけで行い、サーバーには影響しません。API が使えない環境でも疑似データで表示できます。

## 通知の設定

`wrangler.jsonc` で変更できます。

| 項目               | 既定           | 内容                                    |
| ------------------ | -------------- | --------------------------------------- |
| `NOTIFY_AFTER_MIN` | `60`           | 最終使用からこの分数以上 起動中なら通知 |
| `REMIND_EVERY_MIN` | `60`           | 同じ Codespace を再通知する間隔         |
| `triggers.crons`   | `*/15 * * * *` | チェック頻度（UTC）                     |
| `TIMEZONE`         | `Asia/Tokyo`   | 課金集計の「今月」の基準                |

Cron と KV は Workers の無料枠で収まります。GitHub Actions の実行時間は使いません。
