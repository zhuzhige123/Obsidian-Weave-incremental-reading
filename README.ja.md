# Weave Incremental Reading

[中文](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.md#中文文档) | [English](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.md#english) | [日本語](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.ja.md) | [한국어](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.ko.md) | [繁體中文](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.zh-TW.md) | [Русский](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.ru.md)

<div align="center">

**「あとで読む」を、続けて進められる読書キューへ**

Standalone incremental reading for Obsidian — topics, reading points, calendar scheduling, and source resume

</div>

---
![QQ_1784229108205](https://github.com/user-attachments/assets/05b583f0-6485-45a9-9665-b7e4aa95f5ab)
![QQ_1784229164256](https://github.com/user-attachments/assets/649226dd-db4c-4529-95dd-a412898dfe1a)
![QQ20260717-031452-HD](https://github.com/user-attachments/assets/72411a43-638c-4ce8-80ff-8cf5fadbc8ae)

## 日本語ドキュメント

**Weave Incremental Reading**（プラグイン ID：`weave-incremental-reading`）は、Obsidian 向けの**スタンドアロン**増分読書プラグインです。

Markdown、コンテンツブロックリンク、PDF（[PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus) と連携）、Canvas、Web ページ、EPUB などに散らばった素材を、スケジュールでき・続きから読め・元の場所へ戻れる**読書ポイントのキュー**に整理し、**トピック**と**カレンダー**で長期的に進めます——「保存した＝読んだ」で止まらせません。

本プラグインは単体で利用でき、Weave メインプラグインに**依存しません**。Vault 内 EPUB 読書や記憶デッキでのカード作成が必要なときだけ、シリーズの他プラグインを追加してください。

---

### 3 つのコア概念

| 概念 | 説明 |
|------|------|
| **読書ポイント** | 出典トレース付きの 1 件の読書タスク。キューからワンクリックで原文に戻り、続きを読めます。 |
| **トピック（IRDeck）** | 読書ポイントの入れ物。Vault 内の `.irdeck` ファイルとして保存し、テーマや計画ごとにグループ化します。 |
| **増分読書カレンダー** | プラグインのメイン画面。日付ごとに未処理・予定済み・期限超過の読書ポイントを確認し、日々のペースを整えます。 |

---

### コア機能

- **増分読書カレンダー** — 月次ヒートマップと当日キュー；負荷・優先度・期限超過を確認；連続読書などの補助操作
- **統一の「リンクを追加」** — Web、ウィキリンク、ブロック参照、PDF++ 位置、Canvas ノード、EPUB 位置などを貼り付け、名前・トピック・初回予定日を一度に設定
- **トピックと読書ポイント管理** — 優先度、一時停止、アーカイブ；`.irdeck` を開きトピックビューとカレンダーを切り替え
- **スケジューリングと続き読み** — 加工フロー / 読書リストなどの戦略、日次上限と時間予算；完了後に次回出現を自動調整
- **素材インポート** — Markdown からの一括分割インポート；プレミアムではフォルダ購読、PDF / EPUB 章の一括インポート
- **出典へ戻る** — Markdown、PDF++、Canvas、Web、EPUB などで安定した続き読み位置を保持

---

### クイックスタート

1. プラグインをインストールして有効化（下記の[インストール](#インストールと更新)を参照）
2. **増分読書カレンダー**を開く（左リボンのカレンダーアイコン、またはコマンドパレット「増分読書カレンダーを開く」）
3. カレンダー上部の **「+」/ リンクを追加** をクリック：出典を貼り付け → 名前を編集 → トピックを選択 → 初回読書日を設定 → 保存
4. カレンダーで今日の項目を開き、原文で続きを読む；進捗を記録すると、次回出現が自動で決まります

日常の主経路は **リンクを追加** を推奨します。選択コマンドと右クリックメニューも利用できます。

---

### インストールと更新

#### Release からインストール（現在推奨）

1. 本リポジトリの [Releases](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/releases) を開き、最新版の添付ファイルをダウンロード
2. Vault に次のディレクトリを作成：

   ```text
   .obsidian/plugins/weave-incremental-reading/
   ```

3. 同じ Release の `main.js`、`manifest.json`、`styles.css` をそのディレクトリに配置
4. **設定 → コミュニティプラグイン** で **Weave Incremental Reading** を有効化

#### BRAT でバージョンを追跡

[BRAT](https://github.com/TfTHacker/obsidian42-brat) を使う場合、本リポジトリを追加し **Weave Incremental Reading** を選んで更新を確認できます。

#### Obsidian コミュニティプラグインディレクトリ

プラグインがコミュニティディレクトリに掲載されている場合、**設定 → コミュニティプラグイン** で **Weave Incremental Reading** を検索してインストール・更新できます。

#### システム要件

| 項目 | 要件 |
|------|------|
| Obsidian | **≥ 1.8.7**（`manifest.json` の `minAppVersion` に準拠） |
| プラットフォーム | デスクトップとモバイル |

---

### Weave シリーズとの関係

Weave は Obsidian 向けの知識ワークフロープラグイン群で、**読む → 記す → 並べる → 復習する** を軸に長期学習を支えます。本プラグインは**増分読書キューとカレンダー予定**を担当し、他メンバーと役割を分けて組み合わせて使えます。

| プラグイン | 主な役割 |
|------|----------|
| **Weave Incremental Reading**（本プラグイン） | 読書ポイント、トピック、カレンダー予定、続き読みと出典復帰 |
| **Weave メインプラグイン** | 記憶デッキ、問題バンク、抜粋からのカード作成、FSRS 復習など |
| **Weave EPUB Reader** | Vault 内 EPUB 読書、抜粋、章位置の指定 |

組み合わせ方：

- **増分読書キューだけ** — 本プラグインのみで可
- **EPUB を読み章へ戻る** — 本プラグイン + Weave EPUB Reader
- **カード作成と復習も** — 本プラグイン + Weave メインプラグイン
- **完全なループ（読む → 記す → 並べる → 復習する）** — 3 つすべて

外部連携（Weave シリーズ外）：**PDF++** で PDF の選択/位置リンクを作り、「リンクを追加」でキューに入れられます。

---

### 無料機能とプレミアム機能

現行バージョン：**増分読書カレンダーと Markdown 読書ポイントの主フローは無料**で、日常の増分読書に十分です。

| 無料 | プレミアム（ライセンスが必要） |
|------|----------------|
| カレンダーと Markdown 読書ポイント | PDF / EPUB 章の読書ポイント一括インポート |
| トピックと読書ポイント管理（優先度、一時停止、アーカイブ） | スケジューリング戦略のカスタム、インターリーブ学習設定 |
| 基本スケジューリング、今日のキュー、続き読み復帰 | フォルダ購読の自動同期 |
| リンク追加で読書ポイント作成（MD、ブロックリンク、PDF++ など） | 統計分析、読書タイマー、カレンダー背景ウォールなど |
| Markdown からの分割インポート、データ管理ツール | 読書ポイント関連ノートなど追加機能 |

未アクティベート時も、プレミアム入口には明確な案内があり、基本の読書フローは影響を受けません。

**Weave メインプラグイン** をインストール済みで有効化している場合、本プラグインはそのライセンスを継承でき、再アクティベートは不要です。単独の有効化：**設定 → Weave Incremental Reading → ライセンス**。

---

### データとプライバシー

- 読書ポイント、トピック、スケジュール、設定は**既定でローカル Vault に保存**
- プラグインはノート内容を**能動的にアップロードしません**
- クロスプラグイン連携（EPUB 復帰、ライセンス検証など）は、該当機能を実際に使うときだけ発生
- アンインストールしても、作成済みの `.irdeck` と読書ポイントデータは**自動削除されません**；データ管理ツールまたは手動で削除してください

---

### 作者

**Rabbit (zhuzhige)** — [GitHub](https://github.com/zhuzhige123)

- メール：tutaoyuan8@outlook.com
- 問題と提案：[Issues](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/issues)
- ライセンス：[GPL-3.0-or-later](LICENSE)

---

<div align="center">

**読書キューを本当に動かす——ブックマークのまま眠らせない。**

</div>
