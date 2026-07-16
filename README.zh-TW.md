# Weave Incremental Reading

[中文](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.md#中文文档) | [English](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.md#english) | [日本語](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.ja.md) | [한국어](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.ko.md) | [繁體中文](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.zh-TW.md) | [Русский](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.ru.md)

<div align="center">

**把「以後再看」變成可持續推進的閱讀佇列**

Standalone incremental reading for Obsidian — topics, reading points, calendar scheduling, and source resume

</div>

---
![QQ_1784229108205](https://github.com/user-attachments/assets/05b583f0-6485-45a9-9665-b7e4aa95f5ab)
![QQ_1784229164256](https://github.com/user-attachments/assets/649226dd-db4c-4529-95dd-a412898dfe1a)
![QQ20260717-031452-HD](https://github.com/user-attachments/assets/72411a43-638c-4ce8-80ff-8cf5fadbc8ae)

## 繁體中文文件

**Weave Incremental Reading**（外掛 ID：`weave-incremental-reading`）是一款**獨立**的 Obsidian 增量閱讀外掛。

它幫你把散落在 Markdown、內容區塊連結、PDF（配合 [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus)）、Canvas、網頁、EPUB 等處的材料，整理成可排程、可續讀、可回跳的**閱讀點佇列**，再用**專題**與**日曆**長期推進——而不是讓內容停在「收藏了就算讀過了」。

本外掛可單獨使用，**不依賴** Weave 主外掛。需要 EPUB 庫內閱讀或記憶牌組製卡時，再按需安裝系列中的其它外掛。

---

### 三個核心概念

| 概念 | 說明 |
|------|------|
| **閱讀點** | 一條待閱讀任務，帶來源溯源；可從佇列一鍵回跳原文繼續讀。 |
| **專題（IRDeck）** | 閱讀點的容器，以 `.irdeck` 檔案保存在知識庫中，按主題或計畫分組。 |
| **增量閱讀日曆** | 外掛主介面：按日期檢視待處理、已排程與逾期的閱讀點，安排每日節奏。 |

---

### 核心能力

- **增量閱讀日曆** — 月曆熱力與當日佇列；檢視負載、優先級與逾期項；支援連續閱讀等輔助操作
- **統一「新增連結」** — 貼上網頁、雙鏈、區塊引用、PDF++ 定位、Canvas 節點、EPUB 定位等，一次完成命名、專題與首次排程
- **專題與閱讀點管理** — 優先級、暫停、封存；開啟 `.irdeck` 在專題檢視與日曆之間切換
- **排程與續讀** — 加工流 / 閱讀清單等策略，每日上限與時間預算；完成後自動安排下次出現
- **材料匯入** — 從 Markdown 批次拆分匯入；進階功能支援訂閱資料夾、PDF / EPUB 章節批次匯入
- **來源回跳** — Markdown、PDF++、Canvas、網頁、EPUB 等保留穩定續讀位置

---

### 快速上手

1. 安裝並啟用外掛（見下方[安裝](#安裝與更新)）
2. 開啟**增量閱讀日曆**（左側功能區日曆圖示，或命令面板「開啟增量閱讀日曆」）
3. 點擊日曆頂部 **「+」/ 新增連結**：貼上來源 → 修改名稱 → 選擇專題 → 安排首次閱讀日 → 儲存
4. 在日曆中開啟今日待讀項，回到原文續讀；完成後標記進度，系統會安排下次出現時間

日常主路徑建議走 **新增連結**；選區命令與右鍵選單仍可用。

---

### 安裝與更新

#### 從 Release 安裝（目前建議）

1. 開啟本倉庫 [Releases](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/releases)，下載最新版本附件
2. 在知識庫中建立目錄：

   ```text
   .obsidian/plugins/weave-incremental-reading/
   ```

3. 將同一次 Release 中的 `main.js`、`manifest.json`、`styles.css` 放入該目錄
4. 在 **設定 → 社群外掛** 中啟用 **Weave Incremental Reading**

#### 透過 BRAT 追蹤版本

若使用 [BRAT](https://github.com/TfTHacker/obsidian42-brat)，可新增本倉庫並選擇 **Weave Incremental Reading** 檢查更新。

#### Obsidian 社群外掛目錄

若外掛已出現在社群目錄中，可在 **設定 → 社群外掛** 中搜尋 **Weave Incremental Reading** 安裝與更新。

#### 系統需求

| 項目 | 需求 |
|------|------|
| Obsidian | **≥ 1.8.7**（以 `manifest.json` 的 `minAppVersion` 為準） |
| 平台 | 桌面端與行動端 |

---

### 與 Weave 系列的關係

Weave 是一組面向 Obsidian 的知識工作流外掛，圍繞 **讀 → 記 → 排 → 複習** 組織長期學習。本外掛負責其中的**增量閱讀佇列與日曆排程**，與其它成員職責分離、可組合使用。

| 外掛 | 主要職責 |
|------|----------|
| **Weave Incremental Reading**（本外掛） | 閱讀點、專題、日曆排程、續讀與來源回跳 |
| **Weave 主外掛** | 記憶牌組、題庫、摘錄製卡、FSRS 複習等 |
| **Weave EPUB Reader** | 庫內 EPUB 閱讀、摘錄與章節定位 |

怎麼組合：

- **只做增量閱讀佇列** — 只裝本外掛即可
- **還要讀 EPUB 並回跳章節** — 本外掛 + Weave EPUB Reader
- **還要製卡與複習** — 本外掛 + Weave 主外掛
- **完整閉環（讀 → 記 → 排 → 複習）** — 三款都裝

外部協作（非 Weave 系列）：**PDF++** 可用於 PDF 選區/定位連結，再透過「新增連結」納入佇列。

---

### 免費功能與進階功能

目前版本：**增量閱讀日曆與 Markdown 閱讀點主流程免費開放**，足以完成日常增量閱讀。

| 免費 | 進階（需啟用） |
|------|----------------|
| 日曆與 Markdown 閱讀點 | 批次匯入 PDF / EPUB 章節閱讀點 |
| 專題與閱讀點管理（優先級、暫停、封存） | 排程策略自訂、交錯學習設定 |
| 基礎排程、今日待讀、續讀回跳 | 訂閱資料夾自動同步 |
| 新增連結建立閱讀點（含 MD、區塊連結、PDF++ 等） | 統計分析、閱讀計時器、日曆背景牆等 |
| 從 Markdown 拆分匯入、資料管理工具 | 閱讀點關聯筆記等更多能力 |

未啟用時，進階入口會明確提示；基礎閱讀流程不受影響。

若已安裝並啟用 **Weave 主外掛**，本外掛可繼承其授權，無需重複啟用。獨立啟用入口：**設定 → Weave Incremental Reading → 授權**。

---

### 資料與隱私

- 閱讀點、專題、排程與設定**預設保存在本地知識庫**
- 外掛**不會主動上傳**你的筆記內容
- 跨外掛協作（如 EPUB 回跳、授權校驗）僅在對應功能被實際使用時發生
- 解除安裝外掛**不會自動刪除**已建立的 `.irdeck` 與閱讀點資料；清理請用資料管理工具或手動刪除

---

### 作者

**Rabbit (zhuzhige)** — [GitHub](https://github.com/zhuzhige123)

- 信箱：tutaoyuan8@outlook.com
- 問題與建議：[Issues](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/issues)
- 授權條款：[GPL-3.0-or-later](LICENSE)

---

<div align="center">

**讓閱讀佇列真正動起來，而不是躺在收藏夾裡。**

</div>
