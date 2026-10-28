# Weave Incremental Reading

[English](README.en.md) · [官网](https://obsidian-weave.xyz/#pricing) · [使用教程](https://obsidian-weave.xyz/tutorials.html#ir-welcome) · [更新日志](CHANGELOG.md)

<div align="center">

<img src="https://img.shields.io/badge/简体中文-2d333b?style=flat-square" alt="简体中文" /> <img src="https://img.shields.io/badge/繁體中文-2d333b?style=flat-square" alt="繁體中文" /> <img src="https://img.shields.io/badge/English-2d333b?style=flat-square" alt="English" /> <img src="https://img.shields.io/badge/日本語-2d333b?style=flat-square" alt="日本語" /> <img src="https://img.shields.io/badge/한국어-2d333b?style=flat-square" alt="한국어" /> <img src="https://img.shields.io/badge/Русский-2d333b?style=flat-square" alt="Русский" /> <img src="https://img.shields.io/badge/其它语言_后续支持-6b7280?style=flat-square" alt="其它语言后续支持" />

<br/>

![Weave series](https://github.com/user-attachments/assets/a52c0875-9296-4dfd-bf94-114a225f2972)

![Weave series](https://github.com/user-attachments/assets/86b1adbd-d1e2-411f-842d-24402a3c054d)

![Weave Incremental Reading](https://github.com/user-attachments/assets/93ae9bdd-84d8-4f7e-b0f9-6ede5924a518)

</div>

---

## 插件概述

**Weave Incremental Reading** 是面向 Obsidian 的**独立**增量阅读插件。

它把 Markdown、块引用、PDF、Canvas、网页、EPUB 等来源整理为带溯源的**阅读点**，用**专题（`.irdeck`）**分组，用**增量阅读日历**按日推进。打开条目即可回跳原文续读；进度与专题以库内文件保存，数据留在本地。

| 概念 | 说明 |
|------|------|
| **阅读点** | 调度与续读的最小单位：一条待读任务，带来源定位 |
| **专题（`.irdeck`）** | 阅读点容器，按主题或计划分组，保存在知识库中 |
| **增量阅读日历** | 日常主界面：今日待读、已排期、逾期与负载 |

本插件**不依赖** Weave 主插件即可单独使用。需要库内 EPUB 阅读或记忆牌组制卡时，再按需组合系列中的其它成员。

最低 Obsidian 版本：**1.8.7**（以 `manifest.json` 的 `minAppVersion` 为准）。桌面端与移动端均可用。

完整使用教程见官网：[Incremental Reading 教程](https://obsidian-weave.xyz/tutorials.html#ir-welcome)；日历顶部亦可打开插件内帮助。价格与授权说明见 [官网 · 价格](https://obsidian-weave.xyz/#pricing)。

---

## 基础体验与高级支持

日历与 Markdown 阅读点主流程**免费可用**，足以完成日常增量阅读。高级能力需激活后使用。

| 类别 | 能力 | 基础体验 | 高级支持 |
| --- | --- | :---: | :---: |
| **平台** | 全平台（桌面 / 移动端） | ✅ | ✅ |
| | 多语言界面（简体中文、繁體中文、English、日本語、한국어、Русский；其它语言后续支持） | ✅ | ✅ |
| **日历与日常** | 增量阅读日历（月历热力、今日队列、逾期处理） | ✅ | ✅ |
| | 连续阅读、Markdown 块聚焦模式 | ✅ | ✅ |
| **收录与导入** | 添加链接（网页、双链、块引用、PDF++、Canvas、EPUB 定位等） | ✅ | ✅ |
| | Markdown 材料导入、数据管理 | ✅ | ✅ |
| | PDF / EPUB 章节阅读点批量导入 | 🔒 | ✅ |
| | 订阅文件夹自动同步 | 🔒 | ✅ |
| **专题与续读** | 专题与阅读点（优先级、暂停、归档） | ✅ | ✅ |
| | 来源续读回跳（Markdown / PDF++ / Canvas / 网页 / EPUB） | ✅ | ✅ |
| | 关联笔记 | 🔒 | ✅ |
| **调度** | 基础调度（统一默认节奏、每日上限、时间预算、负荷回拉） | ✅ | ✅ |
| | 负载与顺延、交错学习 | 🔒 | ✅ |
| **段落工作台** | 段落阅读工作台与随机漫游范围 | 🔒 | ✅ |
| **分析与设置** | 分析 · 活跃趋势 | ✅ | ✅ |
| | 数量 / 时机 / 优先级 / 未来负荷等高级分析图 | 🔒 | ✅ |
| | 阅读计时器 | 🔒 | ✅ |
| | YAML 标签同步等基础设置 | ✅ | ✅ |
| | 标签组（仍在完善中，勿作主流程依赖） | 🔒 | ✅ |

> 图例：✅ 已包含 · 🔒 需启用高级支持

- **启用高级支持**：在 **设置 → Weave Incremental Reading → 授权** 中激活。本插件高级支持**不单独售卖**，随 [Weave 系列激活码](https://obsidian-weave.xyz/#pricing) 一并提供；若已安装并激活 **Weave Deck（主插件）**，也可继承授权。
- 未激活时，高级入口会明确提示或显示为带锁预览（可在设置中开启「高级功能预览」）；基础流程不受影响。

---

## 核心功能

### 增量阅读日历

日常主界面：按日查看待处理、已排期与逾期阅读点，用月历热力感受负载。可在此调整优先级、处理逾期、开启连续阅读，并在专题视图与日历之间切换。

详见官网教程：[增量阅读日历](https://obsidian-weave.xyz/tutorials.html#ir-calendar)。

### 添加链接与材料导入

日常收录优先走 **「+」/ 添加链接**：粘贴网页、`[[双链]]`、块引用、PDF++、Canvas 或 EPUB 定位，一次完成命名、专题与首次阅读日。

整份 Markdown 或整书需要拆分入库时，再用 **导入阅读材料**。高级支持下可批量导入 PDF / EPUB 章节阅读点，并订阅文件夹自动补齐新材料。

详见官网教程：[添加阅读点](https://obsidian-weave.xyz/tutorials.html#ir-add-points) · [材料导入与订阅](https://obsidian-weave.xyz/tutorials.html#ir-import-subscribe)。

### 专题与阅读点

专题以 `.irdeck` 文件保存在知识库中，是阅读点的分组容器。阅读点可设置优先级、暂停与归档；同一时刻归属一个专题。打开阅读点即回跳到来源位置继续读。

详见官网教程：[来源与续读](https://obsidian-weave.xyz/tutorials.html#ir-source-resume)。

### 调度与续读

统一默认节奏，配合每日上限与时间预算。标记进度后安排下次出现，而不是永远堆在「待读」。负荷回拉等基础调参免费可用；负载顺延、交错学习等属高级支持。

详见官网教程：[调度与进度](https://obsidian-weave.xyz/tutorials.html#ir-scheduling)。

### 段落工作台与其它进阶

高级支持下可使用**段落阅读工作台**（按段落聚焦阅读与排程、随机漫游范围）、阅读计时器、关联笔记，以及除「活跃趋势」以外的分析图表。标签组仍在完善中，请勿当作当前版本日常主路径。

详见官网教程：[设置说明](https://obsidian-weave.xyz/tutorials.html#ir-settings)。

---

## 安装指南

### 方式一：从 Release 安装（推荐）

1. 打开 [Releases](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/releases)，下载最新版本附件
2. 在知识库中创建目录：

```text
.obsidian/plugins/weave-incremental-reading/
```

3. 将**同一次** Release 中的 `main.js`、`manifest.json`、`styles.css` 放入该目录
4. 在 **设置 → 社区插件** 中启用 **Weave Incremental Reading**

### 方式二：通过 BRAT

使用 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 时，添加本仓库并选择 **Weave Incremental Reading** 跟踪更新。

### 方式三：社区插件目录

若已上架社区目录，可在 **设置 → 社区插件 → 浏览** 中搜索 **Weave Incremental Reading** 安装与更新。

### 系统要求

| 项目 | 要求 |
|------|------|
| Obsidian | **≥ 1.8.7** |
| 平台 | 桌面端与移动端 |

---

## 快速上手

1. 安装并启用插件
2. 打开**增量阅读日历**（功能区日历图标，或命令「打开增量阅读日历」）
3. 点击顶部 **「+」/ 添加链接**：粘贴来源 → 命名 → 选择专题 → 安排首次阅读日 → 保存
4. 从今日列表打开并续读；标记进度后，系统会安排下次出现

日常新增优先走 **添加链接**；整份文档或整书拆分再用材料导入。选区命令与右键菜单仍然可用。

更细的步骤见官网：[入门概览与快速上手](https://obsidian-weave.xyz/tutorials.html#ir-intro)。

---

## 数据与隐私

- 阅读点、专题、调度与设置默认保存在**本地知识库**（默认数据根大致为 `weave Incremental reading/`，可在设置中修改）
- 插件**不会主动上传**笔记正文
- 跨插件协作（如 EPUB 回跳、授权校验）仅在实际使用对应功能时发生
- 卸载**不会自动删除** `.irdeck` 与阅读点数据；清理请用数据管理工具或手动删除

多端同步时，请优先同步 Vault 内数据根与 `.irdeck` 文件；插件目录下的缓存多数可重建，不必强求一致。详见官网教程：[数据与维护](https://obsidian-weave.xyz/tutorials.html#ir-data)。

---

## 与 Weave 系列

Weave 系列共有三款插件，围绕 **读 → 记 → 排 → 复习** 组合使用，职责彼此独立：

| 插件 | 职责 |
|------|------|
| **Weave Incremental Reading**（本插件） | 阅读点、专题、日历调度、续读与来源回跳 |
| **Weave Deck**（主插件） | 记忆牌组、题库、摘录制卡、FSRS 复习 |
| **Weave EPUB Reader** | 库内 EPUB 阅读、摘录与章节定位 |

| 需要… | 安装 |
|-------|------|
| 仅增量阅读队列 | 本插件 |
| EPUB 库内读 + 章节续读 | 本插件 + Weave EPUB Reader |
| 制卡与间隔复习 | 本插件 + Weave Deck |
| 完整闭环 | 三款都装 |
| PDF 选区精确定位 | 另装 [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus)，经「添加链接」纳入队列 |

详见官网教程：[与 Weave 系列](https://obsidian-weave.xyz/tutorials.html#ir-weave-family)。

---

## 常见问题

### 1. 必须安装 Weave 主插件吗？

**不必。** 本插件可独立完成日历、专题、Markdown 阅读点与基础调度。只有在需要 EPUB 章节续读、制卡复习，或希望继承主插件授权时，再安装对应系列成员。

### 2. 免费能做什么？高级解锁什么？

免费覆盖日历、专题、添加链接、Markdown 导入与续读、基础调度与「活跃趋势」分析。段落工作台、PDF/EPUB 章节导入、订阅文件夹、负载顺延、交错学习、高级分析图、计时器与关联笔记等需高级支持。详见上方功能表。

### 3. 和「书签 / 待读文件夹」有什么区别？

书签与文件夹只负责存放；本插件给每条材料一个**可回跳位置**和**下次出现的日子**，用日历约束每日负载，让队列真正推进，而不是越积越高。

### 4. 数据存在哪里？多端怎么同步？

业务数据在 Vault 数据根（专题 `.irdeck`、阅读点等），会随你现有的 Obsidian Sync / iCloud / 网盘库同步。优先同步 Vault 内容；插件目录缓存通常不必跨设备强一致。

### 5. 卸载会删除阅读数据吗？

**不会。** 卸载不会自动删除 `.irdeck` 与阅读点文件。若要清理，请使用插件内数据管理工具，或手动删除对应文件。

### 6. EPUB / PDF 续读还要装什么？

- **EPUB 章节定位与回跳**：安装并启用 **Weave EPUB Reader**，并使用定位链接添加阅读点  
- **PDF 选区定位**：使用 **PDF++** 生成的选区 / 书签链接再「添加链接」；仅有文件路径的阅读点无法精确到选区  
- **PDF / EPUB 章节批量导入**：另需启用本插件的高级支持  

### 7. 日常该用「添加链接」还是「材料导入」？

日常单条收录用 **添加链接**。整篇 Markdown 拆分、或整书按章节入库，再用 **导入阅读材料**（章节导入属高级支持）。

### 8. 如何激活？订阅还是买断？

高级支持为**一次性买断**（永久授权、邮箱绑定、支持五台设备），不是按月订阅。本插件**不单独售卖**，请购买 [Weave 系列激活码](https://obsidian-weave.xyz/#pricing)；购后三款高级支持一并可用。若已激活 Weave Deck，也可在本插件中继承授权。激活入口：**设置 → Weave Incremental Reading → 授权**。更多问答见官网：[常见问题](https://obsidian-weave.xyz/tutorials.html#ir-faq)。有问题可发邮件：tutaoyuan8@outlook.com。

---

## 更多文档

| 资源 | 链接 |
|------|------|
| 官网 / 价格 | [obsidian-weave.xyz](https://obsidian-weave.xyz/#pricing) |
| 使用教程 | [tutorials.html · Incremental Reading](https://obsidian-weave.xyz/tutorials.html#ir-welcome) |
| 更新日志 | [CHANGELOG.md](CHANGELOG.md) |
| 问题反馈 | [Issues](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/issues) |
| 许可证 | [GPL-3.0-or-later](LICENSE) |

---

## 许可证与作者

源代码以 [GPL-3.0-or-later](LICENSE) 发布。

- 作者：**Rabbit (zhuzhige)**
- GitHub：https://github.com/zhuzhige123
- 邮箱：tutaoyuan8@outlook.com
