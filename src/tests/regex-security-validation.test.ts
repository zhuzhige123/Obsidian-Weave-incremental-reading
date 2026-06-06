/**
 * 正则表达式安全校验测试
 */
import { getRegexSecurityAdvice, validateRegex, validateRegexSync } from '../utils/regex-validator';

describe('正则表达式安全校验测试', () => {
  test('应该识别最危险的 ReDoS 模式', () => {
    const dangerousPatterns = [
      'a*+',
      'a++',
      '(a*)*',
      '(a+)+',
      '(a*)+',
      '(a+)*'
    ];

    for (const pattern of dangerousPatterns) {
      const result = validateRegexSync(pattern);
      expect(result.isValid).toBe(false);
      expect(result.criticalIssues).toBeDefined();
      expect(result.criticalIssues?.length).toBeGreaterThan(0);
      expect(result.riskLevel).toBe('critical');
    }
  });

  test('应该识别高风险模式', () => {
    const highRiskPatterns = [
      '(a|b)*c',
      '(a*b)*',
      '(?=.*a)(?=.*b)',
      'a*?a*'
    ];

    for (const pattern of highRiskPatterns) {
      const result = validateRegexSync(pattern, { allowLookahead: true });
      expect(['high', 'critical']).toContain(result.riskLevel);
      expect((result.warnings?.length || 0) + (result.criticalIssues?.length || 0)).toBeGreaterThan(0);
    }
  });

  test('应该允许安全的正则表达式', () => {
    const safePatterns = [
      '^[a-zA-Z0-9]+$',
      '\\d{4}-\\d{2}-\\d{2}',
      '[a-z]+@[a-z]+\\.[a-z]+',
      '^##\\s*([^\\n]+)\\s*\\n+([\\s\\S]*?)$'
    ];

    for (const pattern of safePatterns) {
      const result = validateRegexSync(pattern);
      expect(result.isValid).toBe(true);
      expect(['low', 'medium']).toContain(result.riskLevel);
    }
  });

  test('应该识别复杂度过高的表达式', () => {
    const complexPattern = `(${'a*'.repeat(50)})*`;

    const result = validateRegexSync(complexPattern, { maxComplexity: 100 });
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('复杂');
  });

  test('应该识别过长的正则表达式', () => {
    const longPattern = 'a'.repeat(1500);

    const result = validateRegexSync(longPattern, { maxLength: 1000 });
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('长度');
  });

  test('应该识别语法错误', () => {
    const invalidPatterns = ['[', '(', '*', '+', '?', '{', '(?'];

    for (const pattern of invalidPatterns) {
      const result = validateRegexSync(pattern);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('语法错误');
    }
  });

  test('应该返回安全建议', () => {
    const advice = getRegexSecurityAdvice('(a*)*');
    expect(advice).toBeDefined();
    expect(advice.length).toBeGreaterThan(0);
    expect(advice.some((item) => item.includes('量词'))).toBe(true);
  });

  test('应该识别前后向断言限制', () => {
    const lookaroundPatterns = [
      '(?=test)',
      '(?!test)',
      '(?<=test)',
      '(?<!test)'
    ];

    for (const pattern of lookaroundPatterns) {
      const result = validateRegexSync(pattern, {
        allowLookahead: false,
        allowLookbehind: false
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('断言');
    }
  });

  test('应该识别反向引用限制', () => {
    const backrefPatterns = [
      '(a)\\1',
      '(test).*\\1',
      '([a-z])\\1+'
    ];

    for (const pattern of backrefPatterns) {
      const result = validateRegexSync(pattern, { allowBackreferences: false });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('反向引用');
    }
  });

  test('应该识别过大的量词范围', () => {
    const largeQuantifierPatterns = [
      'a{1000,}',
      'b{100,2000}',
      'c{500,1500}'
    ];

    for (const pattern of largeQuantifierPatterns) {
      const result = validateRegexSync(pattern);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((warning) => warning.includes('大范围量词'))).toBe(true);
    }
  });

  test('应该识别过长的字符类', () => {
    const longCharClass = `[${'a-z'.repeat(10)}]`;

    const result = validateRegexSync(longCharClass);
    expect(result.warnings).toBeDefined();
    expect(result.warnings?.some((warning) => warning.includes('字符类过长'))).toBe(true);
  });

  test('应该识别过多嵌套分组', () => {
    const nestedGroups = '((((a))))((((b))))((((c))))((((d))))';

    const result = validateRegexSync(nestedGroups);
    expect(result.warnings).toBeDefined();
    expect(result.warnings?.some((warning) => warning.includes('嵌套分组过多'))).toBe(true);
  });
});

describe('异步正则校验测试', () => {
  test('应该返回性能指标', async () => {
    const pattern = '^[a-zA-Z0-9]+$';

    const result = await validateRegex(pattern);
    expect(result.isValid).toBe(true);
    expect(result.performanceMetrics).toBeDefined();
    expect(result.performanceMetrics?.maxExecutionTime).toBeGreaterThanOrEqual(0.001);
    expect(result.performanceMetrics?.averageTime).toBeGreaterThanOrEqual(0.001);
    expect(result.performanceMetrics?.failedTests).toBeDefined();
  });

  test('应该处理潜在性能问题', async () => {
    const problematicPattern = '(a+)+b';

    const result = await validateRegex(problematicPattern, { timeoutMs: 100 });

    if (!result.isValid) {
      expect(
        result.error?.includes('时间') || result.error?.includes('安全风险')
      ).toBe(true);
    } else {
      expect(result.performanceMetrics).toBeDefined();
    }
  });
});

describe('官方模板正则兼容性测试', () => {
  test('应该认为官方模板处于安全范围', () => {
    const officialPatterns = [
      '##\\s*([^\\n]+)\\s*\\n+([\\s\\S]*?)(?:\\n\\*\\*标签\\*\\*:\\s*([^\\n]+))?$',
      '##\\s*([^\\n]+)\\s*\\n+\\*\\*选项\\*\\*:\\s*\\n([\\s\\S]*?)(?:\\n\\*\\*解析\\*\\*:\\s*([^\\n]*?))?(?:\\n\\*\\*标签\\*\\*:\\s*([^\\n]+))?$',
      '^([\\s\\S]*?)(?:\\n\\*\\*提示\\*\\*:\\s*([^\\n]*?))?(?:\\n\\*\\*标签\\*\\*:\\s*([^\\n]+))?$'
    ];

    for (const pattern of officialPatterns) {
      const result = validateRegexSync(pattern);

      expect(result.isValid).toBe(true);
      expect(result.riskLevel).not.toBe('critical');

      if (result.warnings && result.warnings.length > 0) {
        expect(['low', 'medium', 'high']).toContain(result.riskLevel);
      }
    }
  });
});
