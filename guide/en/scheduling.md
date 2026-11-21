# Scheduling and progress

Scheduling decides **when a reading point reappears on the calendar**. It serves reading rhythm—**not** Weave Review’s FSRS reviews.

Basic scheduling (today’s queue, next appearance after progress, priority, suspend/archive) is part of the free main flow. **Deep strategy customization and interleaving** are premium—follow lock hints in Settings.

## Universal default rhythm

The plugin uses one universal seed interval set (calendar **Intensive / Normal / Slow** ≈ **1 / 3 / 7 days**), shared with completion. There is no Processing / Reading-list toggle; upgrades migrate to this default automatically.

Rhythm after that comes from the calendar menu and completion, settings such as time budget / daily cap / load defer, and automatic load calculations. Ship the add → resume → schedule loop first, then tune.

## Common rhythm controls (concepts)

Exact sliders live under **Settings → Scheduling / Tag groups**. Typical ideas:

| Concept | Intuition |
|---------|-----------|
| **Daily time budget** | Minutes you intend to read |
| **Daily reading-point cap** | Soft count ceiling against short-item floods |
| **Flow stretch** | Elastic band slightly above baseline load |
| **Auto defer under load** | In the **plan view**, push work later when overloaded (by default does **not** rewrite committed next-due on disk) |
| **Cross-day smoothing** | Plan-view smoothing across days (same: default memory-only vs committed due) |

Day-load summaries on the calendar often show baseline, stretch ceiling, and assigned minutes.

## Point actions and states

| Action | Meaning |
|--------|---------|
| Open / resume | Jump to source |
| Mark progress | Compute next appearance with the shared formula and your settings |
| Reschedule | Set or move the day |
| Priority | Relative importance in the queue |
| Suspend | Leave the main today queue; restore from continue-reading suggestions |
| Archive | End active scheduling; Markdown sources may get an archive-related tag for vault filters |
| Remove | Drop from topic/queue (confirm first) |

Archive, suspend, resume, and remove share one schedule write path so the list updates by hide rules promptly.

## Continuous reading and parent/child

For multi-point sources, use **continuous reading** on the calendar. Parent/child structures may show overall progress when the UI presents them. See [Calendar · Continuous reading](calendar.md#continuous-reading).

## Subscription and “today” pins

- **Add to today** → pin on today  
- **Schedule normally** → spread by horizon/load  

See [Import and subscription](import-and-subscription.md).

## Optional premium surfaces

| Feature | Note |
|---------|------|
| Load & deferral | Load defer, horizon smoothing, overload buffer, appearance caps (premium) |
| Interleaving | Related settings (premium) |
| Reading timer | Per-point duration (premium) |
| Analytics | Load forecast / stats (premium) |
| Tag groups | Per-tag preferences—**still being improved; not a daily dependency** |

## Best practices

1. Use defaults until the loop works  
2. Raise the point cap only after time budget is insufficient alone  
3. Clear overdue with reschedule or rebalance—don’t ignore it  
4. Use Weave Review for memory review—not a fake Anki inside IR  

## Related

[Philosophy](philosophy.md) · [Settings](settings.md) · [Best practices](best-practices.md)
