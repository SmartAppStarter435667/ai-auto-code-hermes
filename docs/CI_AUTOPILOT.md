# CI Autopilot — Capture → Issue → Agent Fix

3段階のパイプラインです。各段はそれぞれ単体でも成立するように分離してあります
(Stage 3を無効にしても Stage 1+2 だけで「エラーを拾ってIssue化する」は動きます)。

```
┌─────────────┐   workflow_run    ┌──────────────────────┐   POST /ci-fix   ┌─────────────────────┐
│ Deploy       │  (completed,     │ ci-autopilot.yml       │ ───────────────▶│ ai-service            │
│ workflows    │   conclusion=    │  Stage 1: ログ取得      │                  │  ciFix.ts              │
│ (既存)        │   failure)       │  Stage 2: fingerprint  │                  │  Stage 3: 修正エージェント│
└─────────────┘ ───────────────▶ │  dedupe → Issue作成/更新 │                  │  (buildFixTools +       │
                                  └──────────────────────┘                  │   ciFixPrompt)          │
                                                                             └──────────┬──────────────┘
                                                                                        │ github_create_branch
                                                                                        │ github_write_file
                                                                                        │ daytona_* (検証)
                                                                                        │ github_create_pr
                                                                                        ▼
                                                                             hermes-fix/issue-N ブランチ
                                                                             + PR (レビュー必須, 自動マージなし)
                                                                             + Issueへのコメント
```

## Stage 1 — Capture

`.github/workflows/ci-autopilot.yml` が `workflow_run` イベント (`types: [completed]`) で
既存のdeployワークフローを監視します。`conclusion == 'failure'` の場合のみ発火し、
失敗したjobのログを認証済みAPIで取得、`##[error]` 行を優先的に抜粋します。

**重要な制約**: `workflow_run` は `workflows:` に監視対象を明示的に列挙する必要があります
(「全部監視」というオプションはスキーマ上存在しません)。新しいdeployワークフローを
追加したら、このリストへの追記を忘れないでください — 忘れても実行時エラーにはならず
静かに監視対象から漏れるだけなので、気づきにくい失敗モードです。

## Stage 2 — Issue化(重複排除)

エラーメッセージの先頭行 + job名 + step名からSHA256フィンガープリントを生成し、
`ci-failure`ラベルの既存Issue本文に埋め込まれた`<!-- fingerprint:xxx -->`と照合します。

- 一致 → 新規Issueは作らず「run #NNでも再発」とコメントのみ追加
- 不一致 → 新規Issue作成 (`ci-failure`, `auto-generated`ラベル)

## Stage 3 — Agentによる修正

新規Issue作成時、`ai-service`の`POST /ci-fix`を呼び出します。これは**HermesAgent
(Durable Object・WebSocketチャット)とは別の、ステートレスな一回実行のWorkerハンドラ**です
— 継続セッションを持つ必要がないタスクにDOを使う理由がないための設計判断です。

エージェントのツールセットは意図的に絞ってあります(`buildFixTools()` — 通常の
`buildTools()`から`github_create_issue`/`github_list_issues`を除外)。理由: Issueの
作成・重複排除はすでにStage 2が担っており、修正エージェントにもその権限を与えると
Issueが増殖するリスクがあるためです。

### プロンプト設計の要点(`agent/ciFixPrompt.ts`)

対話モードの`buildSystemPrompt`とは意図的に別物として設計しています。無人で書き込み
権限を持つエージェントに「なんでも手伝う friendly assistant」的な人格は不適切なため:

1. **スコープの厳格な制限** — 指定された失敗の修正のみ。ついでに見つけた別の問題は
   PRの説明に書くだけで、勝手に直さない(無人エージェントの主な失敗モードは
   「スコープが際限なく広がること」なので、これを積極的に抑制する指示を入れています)
2. **検証必須** — 修正前後の両方でDaytonaに実際に失敗コミットを再現させ、同じ
   コマンドを実行して確認。ログだけを信じて「直ったはず」と判断させません
3. **有界な自律性** — 最大15ラウンドのツール呼び出し予算。確信が持てない場合は
   無理にコミットせず、Issueに状況をコメントして停止するよう明示

## セットアップ

### 1. GitHub Secrets(リポジトリ Settings → Secrets → Actions)

| Secret | 説明 |
|---|---|
| `AI_SERVICE_URL` | 例: `https://hermes-ai-service.<subdomain>.workers.dev` |
| `CI_AUTOPILOT_SECRET` | `openssl rand -hex 32` で生成。ai-service側と一致させる |

### 2. ai-service側のsecret

```bash
cd apps/ai-service
openssl rand -hex 32 | npx wrangler secret put CI_AUTOPILOT_SECRET
```
同じ値をGitHub Secretsの`CI_AUTOPILOT_SECRET`にも設定してください。

### 3. デプロイ

```bash
cd apps/ai-service && npx wrangler deploy
git add .github/workflows/ci-autopilot.yml
git commit -m "Add CI Autopilot"
git push
```

`ci-autopilot.yml`は常にデフォルトブランチ上のバージョンで実行されるため
(`workflow_run`の仕様)、mainにpushされて初めて有効になります。

### 4. 動作確認

既存のdeployワークフローを意図的に一度失敗させる(例: 存在しないsecretを一時的に
参照させる)のが一番早い確認方法です。Actionsタブで`CI Autopilot`が起動し、
Issueが作成され、数分後にIssueへコメント + (成功すれば)PRが作成されるはずです。

## 運用方針

- **PRは自動マージしない** — 常にレビュー必須。lintのみの軽微な修正など、信頼が
  積み上がったカテゴリに限定して段階的に自動マージを許可するのが安全な進め方です
- Stage 3を今は使わず、Stage 1+2(Issue化のみ)から始めたい場合は、GitHub Secretsから
  `AI_SERVICE_URL`または`CI_AUTOPILOT_SECRET`のどちらかを未設定のままにしてください
  — ci-autopilot.ymlは自動的にIssue作成のみで止まり、手動トリアージに切り替わります
