# Weave Incremental Reading

[中文](#简介) · [English](README.en.md)

<div align="center">

![Weave series](https://github.com/user-attachments/assets/a52c0875-9296-4dfd-bf94-114a225f2972)

![Weave series](https://github.com/user-attachments/assets/86b1adbd-d1e2-411f-842d-24402a3c054d)

![Weave Incremental Reading](https://github.com/user-attachments/assets/93ae9bdd-84d8-4f7e-b0f9-6ede5924a518)

**把「以后再看」变成可排期、可续读的阅读队列**

独立 Obsidian 增量阅读 · 专题 · 日历调度 · 来源续读

</div>

---

## 简介

**Weave Incremental Reading**（插件 ID：`weave-incremental-reading`）是一款面向 Obsidian 的独立增量阅读插件。

它把 Markdown、块引用、PDF、Canvas、网页、EPUB 等材料收成带溯源的**阅读点**，用**专题**分组，用**日历**按节奏推进——收藏不再等于读过。打开条目即可回跳原文续读；进度与专题以库内文件保存，数据留在本地。

本插件可单独使用，**不依赖** Weave 主插件。需要库内 EPUB 阅读或记忆牌组制卡时，再按需组合系列中的其它成员。

完整教程：[guide/](guide/README.md)（[中文](guide/zh/index.md) · [English](guide/en/index.md)）。日历顶部亦可打开插件内帮助。

---

## 三个核心概念

| 概念 | 说明 |
|------|------|
| **阅读点** | 调度与续读的最小单位：一条待读任务，带来源溯源，可从队列回跳原文。 |
| **专题（`.irdeck`）** | 阅读点的容器，以专题文件保存在知识库中，按主题或计划分组。 |
| **增量阅读日历** | 日常主界面：按日查看待处理、已排期与逾期项，安排负载与节奏。 |

---

## 能做什么

- **增量阅读日历** — 月历热力与当日队列；优先级、逾期与连续阅读等日常操作
- **统一「添加链接」** — 粘贴网页、双链、块引用、PDF++、Canvas、EPUB 定位等；一次完成命名、专题与首次排期
- **专题与阅读点** — 优先级、暂停、归档；在专题视图与日历之间切换
- **调度与续读** — 统一默认节奏、每日上限与时间预算；完成后安排下次出现，打开即可续读
- **材料导入** — 从 Markdown 拆分导入；高级能力支持订阅文件夹、PDF / EPUB 章节批量导入
- **段落阅读工作台**（高级）— 按段落聚焦阅读与排程；支持随机漫游与范围设置
- **来源回跳** — Markdown、PDF++、Canvas、网页、EPUB 等保留稳定续读位置

---

## 快速上手

1. 安装并启用插件（见[安装与更新](#安装与更新)）
2. 打开**增量阅读日历**（功能区日历图标，或命令「打开增量阅读日历」）
3. 点击顶部 **「+」/ 添加链接**：粘贴来源 → 命名 → 选择专题 → 安排首次阅读日 → 保存
4. 从今日列表打开并续读；标记进度后，系统会安排下次出现

日常新增优先走 **添加链接**；整份文档或整书拆分再用材料导入。选区命令与右键菜单仍然可用。

---

## 安装与更新

### 从 Release 安装（推荐）

1. 打开 [Releases](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/releases)，下载最新版本附件
2. 在知识库中创建目录：

   ```text
   .obsidian/plugins/weave-incremental-reading/
   ```

3. 将同一次 Release 中的 `main.js`、`manifest.json`、`styles.css` 放入该目录
4. 在 **设置 → 社区插件** 中启用 **Weave Incremental Reading**

### 通过 BRAT

使用 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 时，添加本仓库并选择 **Weave Incremental Reading** 跟踪更新。

### 社区插件目录

若已上架社区目录，可在 **设置 → 社区插件** 中搜索安装与更新。

### 系统要求

| 项目 | 要求 |
|------|------|
| Obsidian | **≥ 1.8.7**（以 `manifest.json` 的 `minAppVersion` 为准） |
| 平台 | 桌面端与移动端 |

---

## 与 Weave 系列

Weave 系列共有三款插件，围绕 **读 → 记 → 排 → 复习** 组合使用，职责彼此独立：

| 插件 | 职责 |
|------|------|
| **Weave Incremental Reading**（本插件） | 阅读点、专题、日历调度、续读与来源回跳 |
| **Weave Review**（主插件） | 记忆牌组、题库、摘录制卡、FSRS 复习 |
| **Weave EPUB Reader** | 库内 EPUB 阅读、摘录与章节定位 |

- 只做增量阅读队列 → 只装本插件
- 需要 EPUB 章节续读 → 本插件 + Weave EPUB Reader
- 需要制卡与复习 → 本插件 + Weave Review
- 完整闭环 → 三款都装

外部协作：**PDF++** 可用于 PDF 选区 / 定位链接，再经「添加链接」纳入队列。

---

## 基础与高级功能

日历与 Markdown 阅读点主流程**免费可用**，足以完成日常增量阅读。

| 基础（免费） | 高级（需激活） |
|--------------|----------------|
| 日历、专题、Markdown 阅读点与基础调度 | 段落阅读工作台与随机漫游范围 |
| 今日待读、续读回跳、添加链接 | PDF / EPUB 章节阅读点导入 |
| Markdown 材料导入、数据管理 | 负载与顺延、交错学习 |
| 负荷回拉调参、Markdown 块聚焦模式 | 订阅文件夹自动同步 |
| 分析图表入口与「活跃趋势」 | 数量 / 时机 / 优先级 / 未来负荷等图表 |
| YAML 标签同步等基础设置 | 标签组、阅读计时器、关联笔记 |

未激活时，高级入口会明确提示；基础流程不受影响。若已激活 **Weave Review**，本插件可继承其授权。独立激活：**设置 → Weave Incremental Reading → 授权**。

---

## 数据与隐私

- 阅读点、专题、调度与设置默认保存在**本地知识库**
- 插件**不会主动上传**笔记正文
- 跨插件协作（如 EPUB 回跳、授权校验）仅在实际使用对应功能时发生
- 卸载**不会自动删除** `.irdeck` 与阅读点数据；清理请用数据管理工具或手动删除

---

## 文档与支持

| 资源 | 链接 |
|------|------|
| 使用指南 | [guide/](guide/README.md) |
| 更新日志 | [CHANGELOG.md](CHANGELOG.md) |
| 问题反馈 | [Issues](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/issues) |
| 许可证 | [GPL-3.0-or-later](LICENSE) |

---

## 作者

**Rabbit (zhuzhige)** — [GitHub](https://github.com/zhuzhige123)

邮箱：tutaoyuan8@outlook.com

---

<div align="center">

**让阅读队列真正动起来，而不是躺在收藏夹里。**

</div>
