import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { resolveAliasPath, isLikelyAliasPath, findProjectRoot } from '../src/alias.js';

describe('Alias Resolution', () => {
  const workspacePath = path.join(process.cwd(), '.test-alias-workspace');

  beforeAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
    fs.mkdirSync(workspacePath, { recursive: true });

    // Mock tsconfig.json 和 package.json
    fs.writeFileSync(path.join(workspacePath, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        paths: {
          "@/*": ["./src/*"]
        }
      }
    }), 'utf-8');
    fs.writeFileSync(path.join(workspacePath, 'package.json'), '{}', 'utf-8');
  });

  afterAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });

  it('isLikelyAliasPath 应该正确判断是否是别名', () => {
    expect(isLikelyAliasPath('@/components/Btn.vue')).toBe(true);
    expect(isLikelyAliasPath('~/utils/api.js')).toBe(true);
    expect(isLikelyAliasPath('./Btn.vue')).toBe(false);
    expect(isLikelyAliasPath('../Btn.vue')).toBe(false);
  });

  it('findProjectRoot 应该能找到带有配置文件的根目录', () => {
    expect(findProjectRoot(workspacePath)).toBe(workspacePath);
  });

  it('resolveAliasPath 应该能把 @/ 正确映射到物理路径 src/', () => {
    const resolved = resolveAliasPath('@/components/Btn.vue', workspacePath);
    // 使用 replace 处理跨平台斜杠问题
    expect(resolved.replace(/\\/g, '/')).toContain('src/components/Btn.vue');
  });

  it('resolveAliasPath 对于非别名路径应该直接降级处理为相对或绝对路径', () => {
    const resolved = resolveAliasPath('./components/Btn.vue', workspacePath);
    expect(resolved.replace(/\\/g, '/')).toContain('components/Btn.vue');
  });
});
