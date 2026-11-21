# Add reading points

To add **one** reading point, use **Add link / Add reading target**—not material import.

- **Add**: one URL, wikilink/block, selection, Canvas node, or EPUB location  
- **Import**: whole Markdown / PDF outline / EPUB outline → many points ([Import and subscription](import-and-subscription.md))

## Recommended entry

| Entry | Role |
|-------|------|
| Calendar **“+” / Add link** | Daily primary path |
| Command **Add reading target to incremental reading** | Same modal flow |

## Five steps in the modal

1. **Paste a link**, or use **Current location** for a Markdown block / line anchor  
2. **Confirm the name**  
3. **Choose a topic** (`.irdeck`; create if needed)  
4. **Pick the first reading day** (manual or recommended)  
5. **Optionally** create a reading note or append a source marker → confirm to enqueue  

The point then appears on that day’s calendar list; open it to resume.

## Pasteable types

```text
Web:           https://…
Vault / block: [[Note]], [[Note#^blockId]]
PDF++:         selection or bookmark links (including links in PDF callouts)
Canvas:        [[board.canvas#^nodeId]]
EPUB:          location links (requires Weave EPUB Reader)
```

**Example (Markdown block):** paste `[[Research methods#^a1b2c3]]`, name it, pick topic and day.

**Example (web):** paste `https://example.com/article`. Web points usually create an excerpt note carrier; resume opens the URL in Obsidian’s browser.

## Other shortcuts

| Context | Action |
|---------|--------|
| Markdown selection | Command **Create incremental reading point from selection** |
| Obsidian browser | Viewer / selection → **Add to incremental reading** |
| Canvas node | Node menu → **Add to incremental reading** |

Shortcuts only prefill the source; naming, topic, and first day stay the same.

## Defaults and inbox topics

Settings can set a default topic (inbox) for new points. See [Settings](settings.md). Use a stable topic for long plans; park clips in an inbox topic and triage later.

## Best practices

1. Prefer **stable locators** over vague file-only links  
2. One point = one pending reading task; split long sources via import or multiple adds, then use [continuous reading](calendar.md#continuous-reading)  
3. Be honest about the first day—pinning everything to today spikes load  
4. EPUB / precise PDF selections need **Weave EPUB Reader** / **PDF++** for a strong resume

## Related

[Import and subscription](import-and-subscription.md) · [Source and resume](source-and-resume.md) · [Troubleshooting](troubleshooting.md)
