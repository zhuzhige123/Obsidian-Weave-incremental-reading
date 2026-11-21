# Data and maintenance

Topics and reading points live in **vault data**. The plugin folder mainly holds settings and rebuildable cache. Back up the vault data root and every `.irdeck` first.

## Two layers

| Layer | Contents | Backup priority |
|-------|----------|-----------------|
| **Vault data** | Topics, points, materials, registry, … | High—include in vault backup/sync |
| **Plugin folder** | `data.json`, cache, state | Medium—mostly rebuildable |

## Vault data root

Default folder name:

```text
weave Incremental reading/
```

Change it under **Settings → Basic → Data folder**. It is isolated from the shared `weave/` root used by other Weave plugins.

Typical layout:

```text
weave Incremental reading/
  points/                  # .irdeck topic files
  materials/
  registry/
  pdf-bookmark-tasks.json
  epub-bookmark-tasks.json
  IR/                      # compatibility import folder
  editor/                  # temp editor files when produced
```

`IR/` is a legacy compatibility path—use Add link or Import for day-to-day capture.

## `.irdeck` topic files

Each topic is one **`.irdeck`**: metadata plus a `points` array (schedule, trace, relations, …). Treat `.irdeck` records as the source of truth across tools. Opening a file can switch between topic view and calendar.

## Plugin folder

```text
.obsidian/plugins/weave-incremental-reading/
```

| Path | Role |
|------|------|
| `data.json` | Settings |
| `cache/`, `state/` | Local acceleration / runtime |

Uninstall does **not** delete vault `.irdeck` data automatically.

## Data management tools

From Settings or calendar **More → Data management** (when available): inspect topics, unify formats, handle duplicates, backups. Migrate legacy Markdown point formats here—do not keep teaching legacy create paths.

## Backup tips

1. Back up the whole vault (or at least the full data root with every `.irdeck`)  
2. Before changing the data root, confirm the old folder is in place and enumerable  
3. Sync tools must include the data root, not only Markdown notes  
4. Re-activate or inherit license on a new machine via Settings  

## Privacy summary

- Local by default; note bodies are not actively uploaded  
- EPUB resume and license checks only run when those features are used  

## Related

[Settings](settings.md) · [Troubleshooting](troubleshooting.md)
