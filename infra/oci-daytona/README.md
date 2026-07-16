# Hermes — Daytona on OCI (Preview/Server Execution Layer)

## なぜ「Cloudflare vs OCI」ではなく「Cloudflare + OCI」なのか

このディレクトリは、Hermes の **SERVER タブ（vibe coding プレビュー機能）** を支える
Daytona サーバーを OCI 上にセルフホストするための Terraform / CI 一式です。

frontend・git-service・ai-service は引き続き Cloudflare でホストします。
移行が必要なのは Daytona ランタイムのみです。理由は明確です。

| コンポーネント | Cloudflare で稼働可能か | 理由 |
|---|---|---|
| frontend (Pages) | ✅ 問題なし | 静的配信 |
| git-service (Pages Functions) | ✅ 問題なし | Octokit REST 呼び出しのみ、ステートレス |
| ai-service (Worker + DO) | ✅ 問題なし | エージェントループは大半が I/O 待ち（Anthropic/mem0/GitHub 呼び出し）で、CPU time にはカウントされない。Durable Objects の CPU 上限は30秒/リクエストだが、これはネットワーク待機を含まない実行時間 |
| **Daytona (preview 実行エンジン)** | ❌ **不可** | Daytona の Runner は **Docker-in-Docker (DinD)** で動作し、任意のユーザーコードを動かす永続コンテナ/VM が必要。Workers/Pages はコンテナ実行・特権デーモン・任意ポートバインドをサポートしない |

つまり質問への直接的な回答は:
**「アプリ全体」の Cloudflare ホスティングは不可能**（Daytona 部分が構造的に非対応）。
**OCI の方が良いか** → Daytona 部分に関してはYES、他の3サービスに関してはCloudflareのままが最適（Vectorize・エッジ配信・ゼロコールドスタートの恩恵を失う理由がない）。

---

## ⚠️ 重要: Daytona OSS の現状(2026年6月時点)

Terraform を書く前に必ず共有しておきたい情報です。

`daytonaio/daytona` のパブリックリポジトリは **2026年6月以降、開発が非公開コードベースに移行**しており、
このリポジトリは今後 **アップデート・修正・リリースが行われません**。ライセンスの範囲内で
自由にセルフホスト・フォークして利用すること自体は引き続き可能ですが、**公式サポートなし・
今後のセキュリティパッチなし**という前提で使うことになります。

実務上の影響:
- 現時点の `main` ブランチが事実上の "最終スナップショット" — 今後変化しないため、逆に言えば
  すでに固定(ピン留め)された状態と同じです
- とはいえ再現性のため、below の Terraform では **特定コミットへの pin** を推奨コメント付きで用意しています
- 商用サポート付きの後継サービスが必要になった場合は `github.com/daytona` を確認してください

「vibe coding のプレビュー実行」という限定用途であれば、凍結版でも機能的には十分動作します。
ただし将来的な脆弱性対応は自己責任になる点は認識しておいてください。

---

## アーキテクチャ

```
                    ┌──────────────────────────┐
                    │  Cloudflare (現状維持)     │
                    │  frontend / git-service   │
                    │  ai-service (Worker+DO)   │
                    └───────────┬───────────────┘
                                │ REST (DAYTONA_SERVER_URL)
                                ▼
                    ┌──────────────────────────┐
                    │  OCI (新規)                │
                    │  VM.Standard.A1.Flex       │
                    │  (2 OCPU / 12GB — Always  │
                    │   Free 範囲内)              │
                    │  ┌────────────────────┐   │
                    │  │ Caddy (TLS/proxy)   │   │
                    │  │ Daytona API/Proxy   │   │
                    │  │ Daytona Runner(DinD)│   │
                    │  └────────────────────┘   │
                    │  Block Volume (workspace  │
                    │  永続データ)                │
                    └──────────────────────────┘
```

DNS は Cloudflare を DNS-01 チャレンジ用プロバイダとして使う想定です
(Daytona 公式ドキュメントが Cloudflare を明示的にサポート)。ゾーンは Cloudflare に
残したまま、A レコードだけ OCI の Public IP に向けます。ワイルドカードレコード
(`*.proxy.yourdomain.com`)は **DNS-only（グレークラウド）** にする必要があります —
Proxied にすると Daytona の DNS-01 検証とプレビュー URL のルーティングが壊れます。

---

## デプロイ手順

### 1. 一回限りの準備
```bash
# SSH鍵ペア（まだ無ければ）
ssh-keygen -t ed25519 -f ~/.ssh/hermes-daytona -C "daytona-oci"

# terraform.tfvars を作成
cp terraform.tfvars.example terraform.tfvars
# compartment_ocid, ssh_public_key, domain, cloudflare_api_token などを編集
```

### 2. Terraform 適用
```bash
cd infra/oci-daytona
terraform init
terraform plan
terraform apply
```

### 3. Daytona 本体のセットアップ(手動・対話式)
Terraform が VM・ネットワーク・Docker 環境まで用意しますが、Daytona 公式の
`setup-domain-oss-deployment.sh` は GitHub OAuth アプリの Client ID/Secret 入力や
DNS レコード確認など **対話式のステップ**を含むため、意図的に自動実行していません
(推測でフラグ名を決め打ちして壊すより安全な選択です)。

```bash
ssh -i ~/.ssh/hermes-daytona ubuntu@$(terraform output -raw public_ip)
cd /opt/daytona
cat README-DEPLOY.md   # cloud-init が生成する、次の一手だけを示す手順書
```

### 4. Hermes 側との接続
OCI の Daytona が起動したら、Cloudflare 側の secret を更新するだけです:
```bash
cd ../../apps/ai-service
echo "https://daytona.yourdomain.com" | npx wrangler secret put DAYTONA_SERVER_URL
```
`apps/preview-service` も同じ値を Pages の環境変数に設定してください。
コード変更は不要です — `DaytonaClient` は URL を注入するだけの設計です。
