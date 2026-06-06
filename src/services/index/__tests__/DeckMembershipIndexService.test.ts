import { DeckMembershipIndexService } from '../DeckMembershipIndexService';
import { getPluginPaths } from '../../../config/paths';

function normalize(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

function parent(path: string): string {
  const normalized = normalize(path);
  const index = normalized.lastIndexOf('/');
  return index > 0 ? normalized.slice(0, index) : '';
}

function createPlugin(initialFiles: Record<string, string> = {}) {
  const files = new Map<string, string>();
  const folders = new Set<string>(['', '.obsidian', '.obsidian/plugins', '.obsidian/plugins/weave']);

  const ensureDir = (dir: string) => {
    const normalized = normalize(dir);
    if (!normalized) return;
    const parts = normalized.split('/');
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      folders.add(current);
    }
  };

  const writeText = (path: string, content: string) => {
    const normalized = normalize(path);
    ensureDir(parent(normalized));
    files.set(normalized, content);
  };

  for (const [path, content] of Object.entries(initialFiles)) {
    writeText(path, content);
  }

  const adapter = {
    exists: async (path: string) => {
      const normalized = normalize(path);
      return files.has(normalized) || folders.has(normalized);
    },
    mkdir: async (path: string) => {
      ensureDir(path);
    },
    read: async (path: string) => {
      const normalized = normalize(path);
      const value = files.get(normalized);
      if (value === undefined) {
        throw new Error(`File not found: ${normalized}`);
      }
      return value;
    },
    write: async (path: string, content: string) => {
      writeText(path, content);
    },
  };

  return {
    plugin: {
      app: {
        vault: {
          configDir: '.obsidian',
          adapter,
        },
      },
    } as any,
    files,
  };
}

describe('DeckMembershipIndexService', () => {
  it('stores the deck membership index under the plugin cache indices folder', async () => {
    const { plugin, files } = createPlugin();
    const service = new DeckMembershipIndexService(plugin);
    const pluginPaths = getPluginPaths(plugin.app);

    await service.initialize();
    await service.rebuildFromCards(
      [
        { uuid: 'card-1', content: '---\nwe_decks:\n  - 目标牌组\n---\nA' } as any,
        { uuid: 'card-2', content: '---\nwe_decks:\n  - 其他牌组\n---\nB' } as any,
      ],
      [
        { id: 'deck-target', name: '目标牌组' },
        { id: 'deck-other', name: '其他牌组' },
      ],
    );

    expect(files.has(normalize(pluginPaths.indices.deckMembership))).toBe(true);

    const snapshot = JSON.parse(files.get(normalize(pluginPaths.indices.deckMembership)) || '{}');
    expect(snapshot.initialized).toBe(true);
    expect(snapshot.fullRebuildRequired).toBe(false);
    expect(snapshot.deckToCardUUIDs).toEqual({
      'deck-target': ['card-1'],
      'deck-other': ['card-2'],
    });
  });
});
