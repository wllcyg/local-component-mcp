import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { handleGetComponentUsages } from '../src/tools/usages.js';

describe('get_component_usages tool', () => {
  const workspacePath = path.join(process.cwd(), '.test-usages-workspace');

  beforeAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(workspacePath, 'src/components'), { recursive: true });
    fs.mkdirSync(path.join(workspacePath, 'src/views'), { recursive: true });

    // Mock 配置文件以支持别名解析
    fs.writeFileSync(path.join(workspacePath, 'package.json'), '{}', 'utf-8');
    fs.writeFileSync(path.join(workspacePath, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { paths: { "@/*": ["./src/*"] } }
    }), 'utf-8');

    // 目标组件
    fs.writeFileSync(path.join(workspacePath, 'src/components/MyButton.vue'), '<template></template>', 'utf-8');

    // 使用了该组件的文件
    fs.writeFileSync(path.join(workspacePath, 'src/views/Home.vue'), `
<template>
  <div>
    <!-- 模板匹配 (kebab-case) -->
    <my-button />
    <!-- 模板匹配 (PascalCase) -->
    <MyButton />
  </div>
</template>
<script setup>
// import 匹配
import MyButton from '@/components/MyButton.vue';
</script>
    `, 'utf-8');
  });

  afterAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });

  it('应该能精准找到 import、kebab-case 标签以及 PascalCase 标签的引用', async () => {
    const result = await handleGetComponentUsages({ 
      componentPath: path.join(workspacePath, 'src/components/MyButton.vue'),
      workspacePath 
    });
    
    const data = JSON.parse(result.content[0].text);
    expect(data.usages).toBeDefined();
    expect(data.usages.length).toBe(1); // 只有一个文件 (Home.vue) 引用了它
    
    const matches = data.usages[0].matches;
    expect(matches.length).toBeGreaterThanOrEqual(2); 
    const types = matches.map((m: any) => m.type);
    expect(types).toContain('template');
  });
});
