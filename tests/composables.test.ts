import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { handleSearchComposables, handleGetComposableDetail } from '../src/tools/composables.js';

describe('composables tools', () => {
  const workspacePath = path.join(process.cwd(), '.test-composables-workspace');

  beforeAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(workspacePath, 'src/composables'), { recursive: true });
    fs.mkdirSync(path.join(workspacePath, 'src/hooks'), { recursive: true });

    // Composable with JSDoc, typed params, and return object
    fs.writeFileSync(
      path.join(workspacePath, 'src/composables/useCounter.ts'),
      `
/**
 * 计数器 composable，提供增减功能
 */
export function useCounter(initialCount: number = 0) {
  let count = initialCount;
  const increment = () => count++;
  const decrement = () => count--;
  return { count, increment, decrement };
}

export const useDoubleCounter = (value: number) => {
  return { doubled: value * 2 };
};
`,
      'utf-8'
    );

    // Composable with typed return annotation
    fs.writeFileSync(
      path.join(workspacePath, 'src/composables/useAuth.ts'),
      `
import { ref } from 'vue';

export function useAuth(): { isLoggedIn: boolean; logout: () => void } {
  const isLoggedIn = ref(false);
  const logout = () => { isLoggedIn.value = false; };
  return { isLoggedIn: isLoggedIn.value, logout };
}
`,
      'utf-8'
    );

    // React hook in hooks/ directory
    fs.writeFileSync(
      path.join(workspacePath, 'src/hooks/useWindowSize.ts'),
      `
/**
 * 获取窗口尺寸
 */
export function useWindowSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}
`,
      'utf-8'
    );
  });

  afterAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });

  it('search_composables 应该找到所有 useXxx 函数', async () => {
    const result = await handleSearchComposables({ workspacePath });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBeGreaterThanOrEqual(3);
    const names = data.composables.map((c: any) => c.name);
    expect(names).toContain('useCounter');
    expect(names).toContain('useDoubleCounter');
    expect(names).toContain('useAuth');
    expect(names).toContain('useWindowSize');
  });

  it('search_composables keyword 过滤应正常工作', async () => {
    const result = await handleSearchComposables({ workspacePath, keyword: 'auth' });
    const data = JSON.parse(result.content[0].text);
    expect(data.composables.every((c: any) =>
      c.name.toLowerCase().includes('auth') ||
      c.relativeFilePath.toLowerCase().includes('auth')
    )).toBe(true);
  });

  it('get_composable_detail 应提取参数和返回值', async () => {
    const filePath = path.join(workspacePath, 'src/composables/useCounter.ts');
    const result = await handleGetComposableDetail({ filePath });
    const data = JSON.parse(result.content[0].text);
    expect(data.composables.length).toBeGreaterThanOrEqual(1);

    const useCounter = data.composables.find((c: any) => c.name === 'useCounter');
    expect(useCounter).toBeDefined();
    expect(useCounter.params.length).toBe(1);
    expect(useCounter.params[0].name).toBe('initialCount');
    expect(useCounter.params[0].type).toBe('number');
    expect(useCounter.params[0].optional).toBe(true); // has default
    expect(useCounter.returns.length).toBeGreaterThan(0);
  });

  it('get_composable_detail 应提取 JSDoc 描述', async () => {
    const filePath = path.join(workspacePath, 'src/composables/useCounter.ts');
    const result = await handleGetComposableDetail({ filePath });
    const data = JSON.parse(result.content[0].text);
    const useCounter = data.composables.find((c: any) => c.name === 'useCounter');
    expect(useCounter?.description).toContain('计数器');
  });
});
