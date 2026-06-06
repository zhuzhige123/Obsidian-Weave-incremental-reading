import {
  appendHintBlock,
  extractHintMarkdown,
  extractHintText,
  stripHintBlock,
} from './hint-block-utils';

describe('hint-block-utils', () => {
  it('extracts and strips legacy quote hints', () => {
    const content = [
      '正文内容',
      '',
      '>hint: AI制卡的标签功能未正确应用',
    ].join('\n');

    expect(extractHintText(content)).toBe('AI制卡的标签功能未正确应用');
    expect(extractHintMarkdown(content)).toBe('>hint: AI制卡的标签功能未正确应用');
    expect(stripHintBlock(content)).toBe('正文内容');
  });

  it('normalizes we_tip callout blocks to legacy quote markdown', () => {
    const content = [
      '正文内容',
      '',
      '> [!we_tip]',
      '>',
      '> 第一条提示',
      '> 第二条提示',
    ].join('\n');

    expect(extractHintText(content)).toBe('第一条提示\n第二条提示');
    expect(extractHintMarkdown(content)).toBe('>hint: 第一条提示\n> 第二条提示');
    expect(stripHintBlock(content)).toBe('正文内容');
  });

  it('appends new hints using legacy quote syntax', () => {
    expect(appendHintBlock('正文内容', '新的提示')).toBe(
      '正文内容\n\n>hint: 新的提示'
    );
  });
});
