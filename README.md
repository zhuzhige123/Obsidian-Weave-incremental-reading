# Weave Incremental Reading

[中文](#中文文档) | [English](#english-documentation)

<div align="center">

**把「以后再看」变成可持续推进的阅读队列**

[![Obsidian](https://img.shields.io/badge/Obsidian-%E2%89%A5%201.8.7-7c3aed?style=flat-square&logo=obsidian)](https://obsidian.md/)
[![Platform](https://img.shields.io/badge/平台-桌面端%20%7C%20移动端-4b5563?style=flat-square)](https://obsidian.md/)
[![License](https://img.shields.io/badge/License-GPL--3.0--or--later-blue?style=flat-square)](LICENSE)

</div>

---

## 中文文档

**Weave Incremental Reading**（插件 ID：`weave-incremental-reading`）是一款 Obsidian 增量阅读插件。  
它帮你把散落在 Markdown 笔记、内容块链接、PDF（配合 [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus)）、Canvas、网页、EPUB 等处的阅读材料，整理成可排期、可续读、可回跳的**阅读点队列**，并通过**专题**与**日历**长期推进，而不是让内容停留在「收藏了就算读过了」。

---

## 目录

- [这是什么](#这是什么)
- [三个核心概念](#三个核心概念)
- [主要功能](#主要功能)
- [快速上手](#快速上手)
- [常用命令](#常用命令)
- [安装与更新](#安装与更新)
- [免费功能与高级功能](#免费功能与高级功能)
- [与其他插件配合](#与其他插件配合)
- [授权说明](#授权说明)
- [数据与隐私](#数据与隐私)
- [常见问题](#常见问题)
- [反馈与支持](#反馈与支持)

---

## 这是什么

增量阅读（Incremental Reading）是一种长期阅读方法：不是一次性读完所有材料，而是把内容拆成小块，按复习节奏反复推进，直到真正消化。

本插件在 Obsidian 里提供完整工作流：

1. **收拢**：把值得反复看的内容变成阅读点，归入专题。
2. **安排**：用日历决定「今天读什么」，控制每日负载。
3. **续读**：从队列打开材料，回到原文位置继续阅读。
4. **复习**：按间隔再次安排，避免遗忘与积压。

适合这些场景：

- 剪藏、论文、长文、课程笔记需要分多次读完
- 多个主题并行，希望系统自动帮你轮换、排期
- 想在 Obsidian 内统一管理「待读清单」，而不是依赖外部工具

---

## 三个核心概念

| 概念 | 说明 |
|------|------|
| **阅读点** | 一条待阅读任务，通常对应 Markdown 笔记、内容块链接（`[[笔记#^块ID]]`）、PDF++ 定位、网页或 EPUB 等来源。带有溯源信息，方便回跳原文。 |
| **专题（IRDeck）** | 阅读点的容器，以 `.irdeck` 文件保存在知识库中。可按主题、项目或阅读计划分组管理。 |
| **增量阅读日历** | 插件主界面。按日期查看今日待读、已排期与逾期内容，是日常推进阅读的主要入口。 |

---

## 主要功能

### 增量阅读日历

- 按日期浏览待处理、已排期、逾期的阅读点
- 查看当日负载，安排复习时间与优先级
- 支持连续阅读、继续阅读建议等辅助操作
- 桌面端与移动端均可使用

### 阅读点与专题

- **推荐方式**：在增量阅读日历底部功能栏使用 **添加链接**，粘贴或填写来源链接后，修改名称、选择专题、安排首次阅读日并保存
- 支持的来源包括：
  - **Markdown 笔记**：整篇笔记、标题锚点或内容块链接
  - **PDF**：配合 Obsidian **PDF++** 插件，粘贴 PDF++ 选区/定位链接（支持批量）
  - **网页、Canvas、EPUB** 等其它来源
- 将阅读点加入指定专题，统一管理优先级、标签、暂停与归档
- 打开 `.irdeck` 专题文件，在专题视图与日历之间切换推进

### 段落阅读工作台（开发中）

> 该功能仍在开发中，界面与交互可能变动，暂不建议作为日常主流程依赖。

- 围绕当前文档，以段落为单位拆分、浏览与创建阅读点
- 适合长文精读：一边读一边把段落纳入增量阅读队列

### 调度与续读

- 提供**加工流**与**阅读清单**等调度策略（高级功能可自定义）
- 可配置每日新内容上限、复习上限、时间预算
- 支持交错学习，避免长时间只读同一主题
- 安排完成后自动计算下次出现时间，维持长期节奏

### 材料导入与文件夹订阅

- 从 Markdown 文档批量拆分并导入阅读材料
- 订阅指定文件夹：新增 Markdown 可自动补齐到对应专题（高级功能）
- 支持从 PDF / EPUB 导入章节阅读点（高级功能，需配合 EPUB 阅读器插件）

### 数据管理

- 在设置中配置本地数据目录与专题路径
- 提供「增量阅读数据管理」工具，处理重复专题合并、数据整理等维护任务

---

## 快速上手

### 1. 安装并启用

完成[安装](#安装与更新)后，打开 Obsidian **设置 → 社区插件**，启用 **Weave Incremental Reading**。

### 2. 打开增量阅读日历

任选一种方式：

- 点击左侧功能区中的**日历**图标
- 按 `Ctrl/Cmd + P` 打开命令面板，执行：**打开增量阅读日历**

### 3. 创建第一个阅读点（推荐）

在增量阅读日历中，点击底部功能栏的 **添加链接**（**+** 入口），按以下步骤操作：

1. **粘贴或填写链接** — 例如 `[[我的笔记#^块ID]]`、PDF++ 定位链接、网页 URL 等；也可使用 **当前位置** 快速填入正在阅读的位置
2. **修改阅读点名称** — 确认在日历中显示的名称
3. **选择专题** — 指定该阅读点加入哪个增量阅读专题
4. **安排首次阅读日** — 选择「我选日期」或「系统推荐」
5. **确认添加** — 保存后，阅读点即进入调度队列

其它创建方式（选区命令、右键菜单等）仍可使用，但日常建议优先走上述 **添加链接** 流程。

### 4. 在日历中推进阅读

在增量阅读日历中查看今日待读列表。点击阅读点即可打开来源并续读；完成后标记进度，系统会安排下次复习时间。

---

## 常用命令

在命令面板（`Ctrl/Cmd + P`）中搜索以下命令：

| 命令 | 作用 |
|------|------|
| 打开增量阅读日历 | 打开主界面 |
| 打开当前 IRDeck | 当打开 `.irdeck` 专题文件时可用 |
| 从当前选区创建增量阅读点 | 将当前选中文本转为阅读点 |
| 从当前网页添加到增量阅读 | 在 Obsidian 内置 Web Viewer 中可用 |
| 打开增量阅读段落工作台 | 段落阅读工作台（**开发中**） |
| 添加阅读目标到增量阅读 | 与底部功能栏「添加链接」相同，打开统一添加窗口 |
| 更新订阅文件夹 | 手动触发文件夹订阅扫描 |

在 Markdown、Canvas、网页等视图的右键菜单或更多选项中，也可能看到 **添加到增量阅读** 等入口。

---

## 安装与更新

### 方式一：Obsidian 社区插件（推荐）

1. 打开 Obsidian **设置 → 社区插件**
2. 关闭「限制模式」（若尚未关闭）
3. 浏览社区插件，搜索 **Weave Incremental Reading**
4. 安装并启用

之后在社区插件页面点击「检查更新」即可获取新版本。

### 方式二：从 Release 手动安装

1. 打开 [Releases 页面](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/releases)
2. 下载最新版本附件中的 `main.js`、`manifest.json`、`styles.css`（须来自**同一次** Release）
3. 在知识库中创建目录：

   ```text
   .obsidian/plugins/weave-incremental-reading/
   ```

4. 将上述三个文件放入该目录
5. 重启 Obsidian，或在 **设置 → 社区插件** 中重新加载插件

### 方式三：通过 BRAT 跟踪测试版

若你使用 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件，可添加本仓库地址并选择 **Weave Incremental Reading**，通过 BRAT 检查更新获取开发版。

### 系统要求

| 项目 | 要求 |
|------|------|
| Obsidian | **≥ 1.8.7** |
| 平台 | 桌面端与移动端 |

---

## 免费功能与高级功能

当前版本：**增量阅读日历与 Markdown 阅读点工作流已免费开放**，足以完成日常增量阅读。

| 免费功能 | 高级功能 🔒（需激活） |
|----------|----------------------|
| 增量阅读日历与 Markdown 阅读点 | 🔒 导入 PDF / EPUB 章节阅读点（批量导入） |
| 专题与阅读点管理（优先级、暂停、归档） | 🔒 调度策略自定义（加工流 / 阅读清单等） |
| 基础调度与续读、今日待读列表 | 🔒 交错学习设置 |
| 从 Markdown 拆分导入材料 | 🔒 订阅文件夹自动同步 |
| 通过添加链接创建阅读点（含 MD、块链接、PDF++ 等） | 🔒 标签组 |
| 阅读点日常操作（打开、排期、移除） | 🔒 统计分析视图 |
| 数据目录与数据管理工具 | 🔒 阅读计时器 |
| | 🔒 日历背景墙 |
| | 🔒 阅读点关联笔记 |
| | 🔒 更多高级功能（持续增加中） |

未激活高级功能时，插件会明确提示，基础阅读流程不受影响。

---

## 与其他插件配合

本插件是**独立产品**，可单独使用；也可与以下插件协作：

| 插件 | 配合方式 |
|------|----------|
| **PDF++** | 在 PDF 中选区后复制 PDF++ 链接，通过「添加链接」创建阅读点并回跳定位 |
| **Weave 主插件** | 可继承 Weave 授权；部分溯源、制卡等能力由主插件提供 |
| **EPUB 阅读器插件** | 在 EPUB 内创建阅读点、章节定位与续读回跳 |

若你只需要增量阅读队列与日历调度，安装本插件即可；需要 EPUB 内阅读或 Weave 记忆牌组等功能时，再按需安装对应插件。

---

## 授权说明

- 本插件支持**独立增量阅读激活码**
- 若已安装并激活 **Weave 主插件**，增量阅读会自动继承主插件授权，无需重复激活
- 激活入口：**设置 → Weave Incremental Reading → 授权**

---

## 数据与隐私

- 阅读点、专题、调度与设置数据**默认保存在本地知识库**，不会主动上传笔记内容
- 跨插件协作（如 EPUB 回跳、Weave 授权校验）仅在对应功能被实际使用时发生
- 卸载插件不会自动删除已创建的 `.irdeck` 专题文件与阅读点数据；如需清理，请使用数据管理工具或手动删除相关文件

---

## 常见问题

**Q：阅读点和普通笔记有什么区别？**  
阅读点是带调度信息的阅读任务，有下次复习时间、优先级、来源定位等属性；普通笔记没有这些队列管理能力。

**Q：`.irdeck` 文件是什么？**  
它是专题文件，用来组织某一类阅读点。可以在文件列表中像普通笔记一样打开和管理。

**Q：从选区创建阅读点后，原文会被删除吗？**  
取决于设置中的「选区创建行为」。你可以保留原文并插入回链，也可以用阅读点替换选区。

**Q：今天读不完怎么办？**  
可以标记进度、后延到后续日期，或使用调度中的自动后推策略；系统会根据优先级与负载重新安排。

**Q：移动端能用吗？**  
可以。增量阅读日历与基础阅读点操作均支持 Obsidian 移动端。

**Q：没有激活码能用吗？**  
可以。日历、Markdown 阅读点、基础调度与数据管理等核心流程免费可用；高级功能需激活后开启。

---

## 反馈与支持

**作者：Rabbit (zhuzhige)** — [GitHub](https://github.com/zhuzhige123)

- 邮箱：tutaoyuan8@outlook.com
- 问题与建议：[GitHub Issues](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/issues)
- 许可证：[GPL-3.0-or-later](LICENSE)

---

<div align="center">

**让阅读队列真正动起来，而不是躺在收藏夹里。**

</div>

---

## English Documentation

**Weave Incremental Reading** (plugin ID: `weave-incremental-reading`) is an Obsidian plugin for incremental reading workflows.  
It helps you turn scattered material from Markdown notes, block links, PDF (with [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus)), Canvas, web pages, and EPUB into a maintainable **reading-point queue**, organized by **topics** and advanced through a **calendar**—so content does not stay stuck in "saved but never read."

### Table of contents

- [What this plugin does](#what-this-plugin-does)
- [Three core concepts](#three-core-concepts)
- [Main features](#main-features)
- [Quick start](#quick-start)
- [Common commands](#common-commands)
- [Installation and updates](#installation-and-updates)
- [Free vs premium features](#free-vs-premium-features)
- [Working with other plugins](#working-with-other-plugins)
- [Licensing](#licensing)
- [Data and privacy](#data-and-privacy)
- [FAQ](#faq)
- [Feedback and support](#feedback-and-support)

### What this plugin does

Incremental reading is a long-term method: instead of finishing everything at once, you break material into smaller pieces and revisit them on a schedule until they are truly absorbed.

This plugin provides the full workflow inside Obsidian:

1. **Capture** — turn worth-revisiting content into reading points and assign them to topics
2. **Schedule** — use the calendar to decide what to read today and control daily load
3. **Resume** — open a reading point and jump back to the original source
4. **Review** — reschedule items over time so nothing is forgotten or buried

Good fits:

- Clippings, papers, long articles, or course notes you want to finish over multiple sessions
- Parallel topics where you want the system to rotate and schedule for you
- Managing a "to read" queue entirely inside Obsidian

### Three core concepts

| Concept | What it means |
|---------|---------------|
| **Reading point** | A single reading task, usually tied to a Markdown note, block link (`[[note#^blockId]]`), PDF++ location, web page, or EPUB. Keeps trace information so you can jump back. |
| **Topic (IRDeck)** | A container for reading points, stored as an `.irdeck` file in your vault. Group by subject, project, or reading plan. |
| **Incremental reading calendar** | The main plugin view. Browse today's queue, scheduled items, and overdue work. This is your daily entry point. |

### Main features

#### Incremental reading calendar

- Browse pending, scheduled, and overdue reading points by date
- See daily load, set review time and priority
- Continue reading, suggestions, and other helper actions
- Works on desktop and mobile

#### Reading points and topics

- **Recommended:** In the incremental reading calendar, use **Add link** in the bottom toolbar—paste or enter a source link, edit the name, choose a topic, schedule the first read day, and save
- Supported sources include:
  - **Markdown notes:** whole files, heading anchors, or block links
  - **PDF:** with Obsidian **PDF++**—paste PDF++ selection/location links (batch supported)
  - **Web pages, Canvas, EPUB**, and other sources
- Add points to topics; manage priority, tags, suspend, and archive
- Open `.irdeck` topic files and switch between topic view and calendar

#### Paragraph reading workbench (in development)

> This feature is still in development. UI and behavior may change; do not rely on it as your main daily workflow yet.

- Split, browse, and create reading points paragraph by paragraph
- Useful for close reading of long documents

#### Scheduling and resume flow

- Processing-flow and reading-list scheduling strategies (customizable with premium)
- Daily caps for new content and reviews, plus time budget
- Interleaved learning to avoid staying on one topic too long
- Automatic next-review scheduling to keep momentum over time

#### Import and folder subscription

- Split and import reading material from Markdown documents
- Subscribe to folders so new Markdown files are auto-added to topics (premium)
- Import chapter reading points from PDF / EPUB (premium; works best with the EPUB reader plugin)

#### Data management

- Configure local data directory and topic paths in settings
- Use the data management tool for duplicate-topic merge and maintenance

### Quick start

#### 1. Install and enable

After [installation](#installation-and-updates), open **Settings → Community plugins** and enable **Weave Incremental Reading**.

#### 2. Open the incremental reading calendar

Either:

- Click the **calendar** icon in the left ribbon, or
- Press `Ctrl/Cmd + P` and run **Open incremental reading calendar**

#### 3. Create your first reading point (recommended)

In the incremental reading calendar, click **Add link** in the bottom toolbar (**+** entry), then:

1. **Paste or enter a link** — e.g. `[[My note#^blockId]]`, a PDF++ location link, or a web URL; or use **Current location** for what you are reading now
2. **Edit the reading point name** — how it appears in the calendar
3. **Choose a topic** — which incremental reading topic to add it to
4. **Schedule the first read day** — **Pick date** or **Recommended**
5. **Confirm add** — save to enter the scheduling queue

Other paths (selection commands, context menus) still work, but **Add link** is the recommended daily workflow.

#### 4. Advance from the calendar

Check today's queue in the incremental reading calendar. Open a reading point to resume at the source; when done, mark progress and the plugin schedules the next review.

### Common commands

Search in the command palette (`Ctrl/Cmd + P`):

| Command | Purpose |
|---------|---------|
| Open incremental reading calendar | Open the main view |
| Open active IRDeck | Available when an `.irdeck` topic file is active |
| Create incremental reading point from selection | Turn selected text into a reading point |
| Add current web page to incremental reading | Available in Obsidian's built-in Web Viewer |
| Open incremental reading paragraph workbench | Paragraph workbench (**in development**) |
| Add reading target to incremental reading | Same as bottom-toolbar **Add link**—opens the unified add dialog |
| Update subscribed folders | Manually trigger folder subscription scan |

Context menus in Markdown, Canvas, web views, and elsewhere may also show **Add to incremental reading**.

### Installation and updates

#### Option 1: Obsidian Community Plugins (recommended)

1. Open **Settings → Community plugins**
2. Turn off Restricted mode if needed
3. Browse plugins and search for **Weave Incremental Reading**
4. Install and enable

Use **Check for updates** on the Community plugins page for new releases.

#### Option 2: Manual install from Releases

1. Open the [Releases page](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/releases)
2. Download `main.js`, `manifest.json`, and `styles.css` from the **same** release
3. Create this folder in your vault:

   ```text
   .obsidian/plugins/weave-incremental-reading/
   ```

4. Copy the three files into that folder
5. Restart Obsidian or reload community plugins

#### Option 3: Track beta builds with BRAT

If you use [BRAT](https://github.com/TfTHacker/obsidian42-brat), add this repository and select **Weave Incremental Reading** to receive pre-release updates.

#### Requirements

| Item | Requirement |
|------|-------------|
| Obsidian | **≥ 1.8.7** |
| Platform | Desktop and mobile |

### Free vs premium features

In the current version, **the incremental reading calendar and Markdown reading-point workflow are free**, which covers everyday incremental reading.

| Free | Premium 🔒 (license required) |
|------|--------------------------------|
| Calendar and Markdown reading points | 🔒 Import PDF / EPUB chapter reading points (bulk import) |
| Topic and reading-point management | 🔒 Custom scheduling strategy settings |
| Basic scheduling, today's queue, resume | 🔒 Interleaved learning settings |
| Split/import from Markdown | 🔒 Folder subscription auto-sync |
| Create via Add link (MD, block links, PDF++, etc.) | 🔒 Tag groups |
| Daily reading-point operations | 🔒 Analytics view |
| Data directory and data management tool | 🔒 Reading timer |
| | 🔒 Calendar background wall |
| | 🔒 Linked notes for reading points |
| | 🔒 More premium features (coming over time) |

Without premium activation, the plugin clearly marks locked features; core reading flow still works.

### Working with other plugins

This plugin works standalone and can also cooperate with:

| Plugin | How they work together |
|--------|------------------------|
| **PDF++** | Copy PDF++ links from PDF selections; create reading points via **Add link** and jump back to the location |
| **Weave main plugin** | License inheritance; some traceability and card workflows live in Weave |
| **EPUB reader plugin** | Create reading points inside EPUB, chapter navigation, resume back to source |

Install this plugin alone if you only need incremental reading. Add the others when you need EPUB reading or Weave memory-deck features.

### Licensing

- Standalone **incremental reading license key** supported
- If **Weave main plugin** is installed and activated, incremental reading inherits that license
- Activation: **Settings → Weave Incremental Reading → License**

### Data and privacy

- Reading points, topics, schedules, and settings are stored **locally in your vault** by default
- The plugin does not upload note content proactively
- Cross-plugin calls (EPUB resume, Weave license checks, etc.) happen only when you use those features
- Uninstalling the plugin does not automatically delete `.irdeck` files or reading-point data; use the data management tool or remove files manually if needed

### FAQ

**What is the difference between a reading point and a normal note?**  
A reading point is a scheduled reading task with next review time, priority, and source location. A normal note does not include queue management.

**What is an `.irdeck` file?**  
It is a topic file that organizes a set of reading points. You can open and manage it like other vault files.

**Will creating from selection delete the original text?**  
That depends on your selection-create settings. You can keep the source and insert a backlink, or replace the selection with the reading point.

**What if I cannot finish today's queue?**  
Mark progress, postpone items, or rely on auto-postpone in scheduling. The system rebalances by priority and load.

**Does mobile work?**  
Yes. The calendar and basic reading-point operations are supported on Obsidian mobile.

**Can I use the plugin without a license key?**  
Yes. Calendar, Markdown reading points, basic scheduling, and data management are free. Premium features require activation.

### Feedback and support

**Author: Rabbit (zhuzhige)** — [GitHub](https://github.com/zhuzhige123)

- Email: tutaoyuan8@outlook.com
- Issues and suggestions: [GitHub Issues](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/issues)
- License: [GPL-3.0-or-later](LICENSE)

<div align="center">

**Make your reading queue move—not your bookmarks pile up.**

</div>
