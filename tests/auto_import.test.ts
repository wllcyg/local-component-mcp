import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { handleGetComponentUsages } from '../src/tools/usages.js';

describe('auto-import awareness in get_component_usages', () => {
  const workspacePath = path.join(process.cwd(), '.test-autoimport-workspace');

  beforeAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(workspacePath, 'src/components'), { recursive: true });
    fs.mkdirSync(path.join(workspacePath, 'src/views'), { recursive: true });

    // 创建 package.json 和 tsconfig.json
    fs.writeFileSync(path.join(workspacePath, 'package.json'), '{}', 'utf-8');
    fs.writeFileSync(
      path.join(workspacePath, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }),
      'utf-8'
    );

    // 模拟 vite.config.ts 包含 Components({ dirs: ['src/components'] })
    fs.writeFileSync(
      path.join(workspacePath, 'vite.config.ts'),
      `
import { defineConfig } from 'vite';
import Components from 'unplugin-vue-components/vite';

export default defineConfig({
  plugins: [
    Components({
      dirs: ['src/components'],
    }),
  ],
});
`,
      'utf-8'
    );

    // 目标组件（在 auto-import 目录下）
    fs.writeFileSync(
      path.join(workspacePath, 'src/components/AutoButton.vue'),
      '<template><button>auto</button></template>',
      'utf-8'
    );

    // 使用该组件，但没有 import 语句（auto-import 风格）
    fs.writeFileSync(
      path.join(workspacePath, 'src/views/AutoPage.vue'),
      `<template>
  <div>
    <AutoButton />
    <auto-button />
  </div>
</template>
<script setup>
// 没有 import，依赖 unplugin-vue-components 自动注册
</script>`,
      'utf-8'
    );

    // 有显式 import 的文件
    fs.writeFileSync(
      path.join(workspacePath, 'src/views/ManualPage.vue'),
      `<template>
  <div>
    <AutoButton />
  </div>
</template>
<script setup>
import AutoButton from '@/components/AutoButton.vue';
</script>`,
      'utf-8'
    );
  });

  afterAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });

  it('应该找到显式 import 的引用', async () => {
    const result = await handleGetComponentUsages({
      componentPath: path.join(workspacePath, 'src/components/AutoButton.vue'),
      workspacePath,
    });
    const data = JSON.parse(result.content[0].text);
    const manualPage = data.usages.find((u: any) =>
      u.relativeFilePath.includes('ManualPage')
    );
    expect(manualPage).toBeDefined();
    const types = manualPage.matches.map((m: any) => m.type);
    expect(types).toContain('import');
    expect(types).toContain('template');
  });

  it('应该找到 auto-import 的模板引用（无 import 语句）', async () => {
    const result = await handleGetComponentUsages({
      componentPath: path.join(workspacePath, 'src/components/AutoButton.vue'),
      workspacePath,
    });
    const data = JSON.parse(result.content[0].text);
    const autoPage = data.usages.find((u: any) =>
      u.relativeFilePath.includes('AutoPage')
    );
    expect(autoPage).toBeDefined();
    const types = autoPage.matches.map((m: any) => m.type);
    expect(types).toContain('template');
  });
});
