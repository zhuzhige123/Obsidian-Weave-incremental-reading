# Weave Incremental Reading

[中文说明](README.md)

<div align="center">

**A standalone Obsidian plugin for incremental reading queues, reading points, and resume scheduling**

</div>

Weave Incremental Reading (plugin id: `weave-incremental-reading`) helps you turn scattered “read later” material into a durable queue of reading points, organized by topics and advanced through calendar scheduling and source navigation.

---

## Core capabilities

- **Reading points and topics (IRDeck)**: capture selections or sources into `.irdeck` topics
- **Incremental reading calendar**: review due, scheduled, and overdue items by date
- **Scheduling and resume**: processing-flow and reading-list strategies with daily limits
- **Source navigation**: return to the original context from a reading point

---

## Installation

1. Download the latest assets from [Releases](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/releases).
2. Create:

   ```text
   .obsidian/plugins/weave-incremental-reading/
   ```

3. Copy `main.js`, `manifest.json`, and `styles.css` from the same release into that folder.
4. Enable **Weave Incremental Reading** under **Settings → Community plugins**.

BRAT users can track this repository for updates.

---

## Requirements

| Item | Requirement |
|------|-------------|
| Obsidian | **≥ 1.8.7** (see `minAppVersion` in `manifest.json`) |
| Platforms | Desktop and mobile |

---

## Ecosystem split

| Plugin | Responsibility |
|--------|----------------|
| **Weave Incremental Reading** | Incremental reading queue, topics, scheduling, resume |
| **Weave main plugin** | Memory decks, question banks, AI card generation |
| **EPUB reader plugin** | EPUB reading runtime |

---

## Data and privacy

- Reading data stays in your local vault by default
- The plugin does not upload your note content
- Cross-plugin cooperation happens only when you use related features

---

## Distribution

This public repository distributes release artifacts for Obsidian. Runtime files are published via **GitHub Releases**; full TypeScript/Svelte development source is not maintained here.

Report issues via [Issues](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/issues).

---

## Author

**Rabbit (zhuzhige)** — [GitHub](https://github.com/zhuzhige123)
