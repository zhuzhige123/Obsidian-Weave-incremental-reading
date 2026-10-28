# Weave Incremental Reading

[中文说明](README.md) · [Website](https://obsidian-weave.xyz/#pricing) · [Tutorials](https://obsidian-weave.xyz/tutorials.html#ir-welcome) · [Changelog](CHANGELOG.md)

<div align="center">

<img src="https://img.shields.io/badge/简体中文-2d333b?style=flat-square" alt="简体中文" /> <img src="https://img.shields.io/badge/繁體中文-2d333b?style=flat-square" alt="繁體中文" /> <img src="https://img.shields.io/badge/English-2d333b?style=flat-square" alt="English" /> <img src="https://img.shields.io/badge/日本語-2d333b?style=flat-square" alt="日本語" /> <img src="https://img.shields.io/badge/한국어-2d333b?style=flat-square" alt="한국어" /> <img src="https://img.shields.io/badge/Русский-2d333b?style=flat-square" alt="Русский" /> <img src="https://img.shields.io/badge/More_languages_planned-6b7280?style=flat-square" alt="More languages planned" />

<br/>

![Weave series](https://github.com/user-attachments/assets/a52c0875-9296-4dfd-bf94-114a225f2972)

![Weave series](https://github.com/user-attachments/assets/86b1adbd-d1e2-411f-842d-24402a3c054d)

![Weave Incremental Reading](https://github.com/user-attachments/assets/93ae9bdd-84d8-4f7e-b0f9-6ede5924a518)

</div>

---

## Overview

**Weave Incremental Reading** is a **standalone** Obsidian plugin for incremental reading.

It gathers Markdown, block refs, PDF, Canvas, web pages, EPUB, and more into traceable **reading points**, groups them in **topics (`.irdeck`)**, and advances them with an **incremental reading calendar**. Open an item to jump back to the source and continue. Progress and topics live as vault files; your data stays local.

| Concept | Meaning |
|---------|---------|
| **Reading point** | Smallest unit of scheduling and resume: one reading task with source location |
| **Topic (`.irdeck`)** | Container for reading points, grouped by theme or plan, stored in the vault |
| **Incremental reading calendar** | Daily home: today’s queue, scheduled items, overdue work, and load |

It does **not** require the Weave main plugin. Add other Weave family plugins only when you need in-vault EPUB reading or memory-deck / card workflows.

Minimum Obsidian version: **1.8.7** (see `minAppVersion` in `manifest.json`). Desktop and mobile are supported.

Full tutorials live on the official site: [Incremental Reading tutorials](https://obsidian-weave.xyz/tutorials.html#ir-welcome). In-plugin help is also available from the calendar. Pricing and licensing: [Website · Pricing](https://obsidian-weave.xyz/#pricing).

---

## Essential experience and Premium support

The calendar and Markdown reading-point workflow are **free** and cover everyday incremental reading. Premium support unlocks advanced capabilities.

| Capability | Essential | Premium |
|------------|:---------:|:-------:|
| **All platforms** (desktop / mobile) | ✅ | ✅ |
| **Incremental reading calendar** (heatmap, today’s queue, overdue handling) | ✅ | ✅ |
| **Add link** (web URLs, wikilinks, block refs, PDF++, Canvas, EPUB locations, etc.) | ✅ | ✅ |
| **Topics and reading points** (priority, suspend, archive) | ✅ | ✅ |
| **Basic scheduling** (default rhythm, daily caps, time budget, load pull-back) | ✅ | ✅ |
| **Source resume** (Markdown / PDF++ / Canvas / web / EPUB) | ✅ | ✅ |
| **Markdown material import**, data management | ✅ | ✅ |
| **Continue reading**, Markdown block focus mode | ✅ | ✅ |
| **Analytics · Activity trend** | ✅ | ✅ |
| Basic settings such as YAML tag sync | ✅ | ✅ |
| **Multilingual UI** (Simplified Chinese, Traditional Chinese, English, Japanese, Korean, Russian; more languages planned) | ✅ | ✅ |
| **Paragraph reading workbench** and random-roam scope | 🔒 | ✅ |
| Bulk **PDF / EPUB chapter** reading-point import | 🔒 | ✅ |
| **Folder subscription** auto-sync | 🔒 | ✅ |
| **Load & deferral**, **interleaved learning** | 🔒 | ✅ |
| Advanced charts (quantity / timing / priority / future load) | 🔒 | ✅ |
| **Reading timer**, **associated notes** | 🔒 | ✅ |
| **Tag groups** (still evolving—do not treat as the main path yet) | 🔒 | ✅ |

> Legend: ✅ included · 🔒 requires Premium support

- **Enable Premium support**: activate under **Settings → Weave Incremental Reading → License**. Premium for this plugin is **not sold separately**—it comes with the [Weave series activation code](https://obsidian-weave.xyz/#pricing). If **Weave Deck** (main plugin) is installed and activated, authorization can also be inherited.
- Locked entries show a clear prompt or lock preview (enable **Premium feature preview** in settings). The core flow still works without a license.

---

## Core features

### Incremental reading calendar

Your daily home: browse pending, scheduled, and overdue reading points by date, and feel load via the month heatmap. Adjust priority, handle overdue items, use continue-reading, and switch between topic view and calendar.

See the official tutorial: [Incremental reading calendar](https://obsidian-weave.xyz/tutorials.html#ir-calendar).

### Add link and material import

For daily capture, prefer **“+” / Add link**: paste a web URL, `[[wikilink]]`, block ref, PDF++, Canvas, or EPUB location; set name, topic, and first read day in one flow.

Use **Import reading materials** when splitting a whole Markdown document or book. With Premium support you can bulk-import PDF / EPUB chapter reading points and subscribe folders so new files are picked up automatically.

See: [Add reading points](https://obsidian-weave.xyz/tutorials.html#ir-add-points) · [Import and subscription](https://obsidian-weave.xyz/tutorials.html#ir-import-subscribe).

### Topics and reading points

Topics are `.irdeck` files in the vault—containers for grouping. Reading points support priority, suspend, and archive; each belongs to one topic at a time. Opening a reading point jumps back to the source so you can continue.

See: [Source and resume](https://obsidian-weave.xyz/tutorials.html#ir-source-resume).

### Scheduling and resume

A universal default rhythm, plus daily caps and a time budget. After you mark progress, the next appearance is scheduled—so items do not sit forever in “read later.” Basic load pull-back knobs are free; load deferral and interleaved learning require Premium support.

See: [Scheduling](https://obsidian-weave.xyz/tutorials.html#ir-scheduling).

### Paragraph workbench and other advanced tools

With Premium support: **paragraph reading workbench** (focused segment reading and scheduling, random-roam scope), reading timer, associated notes, and analytics charts beyond Activity trend. Tag groups are still evolving—do not rely on them as the daily main path yet.

See: [Settings](https://obsidian-weave.xyz/tutorials.html#ir-settings).

---

## Installation

### Option 1: Install from Releases (recommended)

1. Open [Releases](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/releases) and download the latest assets
2. Create this folder in your vault:

```text
.obsidian/plugins/weave-incremental-reading/
```

3. Copy `main.js`, `manifest.json`, and `styles.css` from the **same** release into that folder
4. Enable **Weave Incremental Reading** under **Settings → Community plugins**

### Option 2: Track with BRAT

If you use [BRAT](https://github.com/TfTHacker/obsidian42-brat), add this repository and select **Weave Incremental Reading**.

### Option 3: Community Plugins directory

If listed, search for **Weave Incremental Reading** under **Settings → Community plugins → Browse**.

### Requirements

| Item | Requirement |
|------|-------------|
| Obsidian | **≥ 1.8.7** |
| Platforms | Desktop and mobile |

---

## Quick start

1. Install and enable the plugin
2. Open the **incremental reading calendar** (ribbon calendar icon, or command **Open incremental reading calendar**)
3. Click **“+” / Add link**: paste source → name → choose topic → schedule first read day → save
4. Open today’s items, resume at the source, mark progress; the plugin schedules the next appearance

Prefer **Add link** for daily use; use material import for whole documents or books. Selection commands and context menus remain available.

More detail: [Intro and quick start](https://obsidian-weave.xyz/tutorials.html#ir-intro).

---

## Data and privacy

- Reading points, topics, schedules, and settings stay in your **local vault** by default (data root is roughly `weave Incremental reading/`, configurable in settings)
- The plugin does **not** upload note content proactively
- Cross-plugin calls (EPUB resume, license checks, etc.) happen only when those features are used
- Uninstalling does **not** automatically delete `.irdeck` files or reading-point data; use the data management tool or remove files manually

When syncing across devices, prioritize the vault data root and `.irdeck` files. Cache under the plugin folder is mostly rebuildable. See: [Data and maintenance](https://obsidian-weave.xyz/tutorials.html#ir-data).

---

## Weave family

There are exactly three Weave plugins. They compose around **read → capture → schedule → review**, with clear boundaries:

| Plugin | Responsibility |
|--------|----------------|
| **Weave Incremental Reading** (this plugin) | Reading points, topics, calendar scheduling, resume and source navigation |
| **Weave Deck** (main plugin) | Memory decks, question banks, excerpt-to-card, FSRS review |
| **Weave EPUB Reader** | In-vault EPUB reading, excerpts, and chapter location |

| Need… | Install |
|-------|---------|
| Incremental reading queue only | This plugin |
| In-vault EPUB + chapter resume | This plugin + Weave EPUB Reader |
| Cards and spaced review | This plugin + Weave Deck |
| Full loop | All three |
| Precise PDF selection locations | Also [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus), then capture via **Add link** |

See: [Weave family](https://obsidian-weave.xyz/tutorials.html#ir-weave-family).

---

## FAQ

### 1. Do I need the Weave main plugin?

**No.** This plugin alone covers calendar, topics, Markdown reading points, and basic scheduling. Install other family members only for EPUB chapter resume, card review, or license inheritance.

### 2. What is free vs Premium?

Free: calendar, topics, Add link, Markdown import and resume, basic scheduling, and the Activity trend analytics tab. Premium: paragraph workbench, PDF/EPUB chapter import, folder subscription, load deferral, interleaved learning, advanced charts, timer, and associated notes. See the capability table above.

### 3. How is this different from bookmarks or a “read later” folder?

Bookmarks and folders only store things. This plugin gives each item a **resumable location** and a **next appearance date**, and uses the calendar to keep daily load honest—so the queue moves instead of piling up.

### 4. Where is data stored? How do I sync across devices?

Business data lives in the vault data root (`.irdeck` topics, reading points, etc.) and follows whatever Obsidian Sync / iCloud / cloud-synced vault you already use. Sync vault content first; plugin-folder cache usually need not be identical across devices.

### 5. Does uninstalling delete my reading data?

**No.** Uninstall does not automatically remove `.irdeck` files or reading-point data. To clean up, use the in-plugin data management tools or delete the files manually.

### 6. What else do I need for EPUB / PDF resume?

- **EPUB chapter location and jump-back**: install and enable **Weave EPUB Reader**, and add reading points with location links  
- **PDF selection locations**: use **PDF++** selection / bookmark links with **Add link**; a bare file path cannot target a selection  
- **Bulk PDF / EPUB chapter import**: also requires Premium support on this plugin  

### 7. Should I use Add link or material import?

Use **Add link** for everyday single items. Use **Import reading materials** to split a whole Markdown document or ingest a book by chapter (chapter import is Premium).

### 8. How do I activate? Subscription or one-time?

Premium support is a **one-time purchase** (permanent license, email binding, up to five devices), not a monthly subscription. This plugin is **not sold separately**—buy the [Weave series activation code](https://obsidian-weave.xyz/#pricing); all three plugins’ Premium support are included. If Weave Deck is already activated, this plugin can inherit authorization. Activate under **Settings → Weave Incremental Reading → License**. More Q&A: [FAQ](https://obsidian-weave.xyz/tutorials.html#ir-faq). Email: tutaoyuan8@outlook.com.

---

## More documentation

| Resource | Link |
|----------|------|
| Website / Pricing | [obsidian-weave.xyz](https://obsidian-weave.xyz/#pricing) |
| Tutorials | [tutorials.html · Incremental Reading](https://obsidian-weave.xyz/tutorials.html#ir-welcome) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |
| Issues | [Issues](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/issues) |
| License | [GPL-3.0-or-later](LICENSE) |

---

## License and author

Source code is released under [GPL-3.0-or-later](LICENSE).

- Author: **Rabbit (zhuzhige)**
- GitHub: https://github.com/zhuzhige123
- Email: tutaoyuan8@outlook.com
