# Weave Incremental Reading

[中文说明](README.md)

<div align="center">

**A standalone Obsidian plugin for incremental reading queues, reading points, and resume scheduling**

[![Obsidian](https://img.shields.io/badge/Obsidian-%E2%89%A5%201.8.7-7c3aed?style=flat-square&logo=obsidian)](https://obsidian.md/)
[![License](https://img.shields.io/badge/License-GPL--3.0--or--later-blue?style=flat-square)](LICENSE)

</div>

Weave Incremental Reading (plugin id: `weave-incremental-reading`) turns scattered “read later” material into a durable queue of reading points with topics, calendar scheduling, and source navigation.

---

## Core capabilities

- Reading points and IRDeck topics
- Incremental reading calendar
- Scheduling and resume workflow
- Source navigation back to original context

---

## Installation

### Community directory (recommended)

Search for **Weave Incremental Reading** under **Settings → Community plugins**.

### Manual install from Releases

1. Download `main.js`, `manifest.json`, and `styles.css` from [Releases](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/releases)
2. Copy them into `.obsidian/plugins/weave-incremental-reading/`
3. Enable the plugin

### Build from source

```bash
git clone https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading.git
cd Obsidian-Weave-incremental-reading
npm install
npm run build
```

Copy `dist/main.js`, `dist/manifest.json`, and `dist/styles.css` into your vault plugin folder.

---

## Requirements

| Item | Requirement |
|------|-------------|
| Obsidian | **≥ 1.8.7** |
| Platforms | Desktop and mobile |

---

## Development

```bash
npm install
npm run dev
```

Pre-release checks:

```bash
npm run lint:obsidian:community:errors
npm run audit:obsidian-release
npm run check
npm run test
npm run build
```

---

## License

Released under [GPL-3.0-or-later](LICENSE).

---

## Author

**Rabbit (zhuzhige)** — [GitHub](https://github.com/zhuzhige123)

Report issues via [Issues](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/issues).
