<img src="src/assets/logo.svg" alt="codespacedash" width="100%" height="100%">

GitHub Codespaces・Actions・Copilot の利用状況を可視化するダッシュボード。

**認証方式**: Personal Access Token（PAT）入力


## セットアップ

### 1. インストール & 起動

```bash
yarn install
yarn dev
```

ブラウザで http://localhost:5173 を開き、PATを入力するだけです。

### 2. PAT の作成

1. GitHubの自分のプロフィールアカウントをクリックして、`Settings`画面に行く
2. サイドバーの`Developer settings`をクリック
3. `Personal Access tokensをクリック`
4. `Fine-grained personal access tokens`をクリック
5. `New generate Token`をクリック
6. `Token name`を設定する(任意の識別名)
7. `Repository access`を`All repositories`にする
8. `Permissions`の`Add permissions`で以下を行う
   - `Repositories`タブは`Codespaces`を選択
   - `Account`タブは`Plan`を選択
9. `Generate token`で生成されたトークンを利用して、このサイトにログインする

必要な権限:

| スコープ | 用途 |
|---------|------|
| `Codespaces` | Codespacesの稼働状況など確認 |
| `Plan` | 課金情報 (無料枠の計算など) |


## セキュリティについて

- PATはブラウザメモリにのみ保持（localStorage 未使用）
- ページを閉じると自動でクリアされます
