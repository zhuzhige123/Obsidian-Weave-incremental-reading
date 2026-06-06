import { DEFAULT_RULE_SPLIT_CONFIG, type RuleSplitConfig } from '../../types/content-split-types';
import { deriveFileTitleFromContent, splitByRules } from '../content-split-utils';

function createConfig(overrides: Partial<RuleSplitConfig> = {}): RuleSplitConfig {
  return {
    ...DEFAULT_RULE_SPLIT_CONFIG,
    enableWholeFile: false,
    enableHeadingSplit: false,
    enableBlankLineSplit: false,
    enableSymbolSplit: false,
    filterEmptyBlocks: true,
    preserveHeadingAsTitle: true,
    minBlockCharCount: 1,
    ...overrides
  };
}

describe('content-split-utils', () => {
  it('整个文件作为一个块时应自动去除 frontmatter', () => {
    const blocks = splitByRules(
      [
        '---',
        'title: 测试标题',
        'tags:',
        '  - demo',
        '---',
        '',
        '# 正文标题',
        '',
        '正文内容'
      ].join('\n'),
      createConfig({
        enableWholeFile: true
      })
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0].content).toBe('# 正文标题\n\n正文内容');
    expect(blocks[0].title).toBe('测试标题');
  });

  it('按空行拆分时应按空行段后的正文开始新块，不生成空块', () => {
    const blocks = splitByRules(
      [
        '第一段',
        '',
        '',
        '第二段',
        '',
        '',
        '',
        '第三段'
      ].join('\n'),
      createConfig({
        enableBlankLineSplit: true,
        blankLineCount: 2
      })
    );

    expect(blocks.map(block => block.content)).toEqual(['第一段', '第二段', '第三段']);
  });

  it('按符号拆分时应移除分隔符行并保留真实正文', () => {
    const blocks = splitByRules(
      [
        '甲内容',
        '---',
        '乙内容',
        '---',
        '丙内容'
      ].join('\n'),
      createConfig({
        enableSymbolSplit: true,
        splitSymbol: '---'
      })
    );

    expect(blocks.map(block => block.content)).toEqual(['甲内容', '乙内容', '丙内容']);
    expect(blocks.some(block => block.content.includes('---'))).toBe(false);
  });

  it('标题拆分与空行拆分叠加时不应产生空块', () => {
    const blocks = splitByRules(
      [
        '前言',
        '',
        '',
        '## 第一节',
        '内容 A',
        '',
        '',
        '## 第二节',
        '内容 B'
      ].join('\n'),
      createConfig({
        enableHeadingSplit: true,
        headingLevels: [2],
        enableBlankLineSplit: true,
        blankLineCount: 2
      })
    );

    expect(blocks).toHaveLength(3);
    expect(blocks.map(block => block.title)).toEqual(['前言', '第一节', '第二节']);
    expect(blocks.every(block => block.content.trim().length > 0)).toBe(true);
  });

  it('最小字符数应在去除分隔符和空白后生效', () => {
    const blocks = splitByRules(
      [
        '短',
        '---',
        '这是一个足够长的内容块'
      ].join('\n'),
      createConfig({
        enableSymbolSplit: true,
        splitSymbol: '---',
        minBlockCharCount: 2
      })
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0].content).toBe('这是一个足够长的内容块');
  });

  it('不保留标题作为块标题时应优先使用标题后的正文首行命名', () => {
    const blocks = splitByRules(
      [
        '## 标题一',
        '',
        '正文第一句',
        '正文第二句'
      ].join('\n'),
      createConfig({
        enableHeadingSplit: true,
        headingLevels: [2],
        preserveHeadingAsTitle: false
      })
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0].title).toBe('正文第一句');
  });

  it('deriveFileTitleFromContent 在没有 YAML 标题时应回退到正文标题或首行', () => {
    expect(deriveFileTitleFromContent('## 章节标题\n\n正文')).toBe('章节标题');
    expect(deriveFileTitleFromContent('普通首行\n第二行')).toBe('普通首行');
  });
});
