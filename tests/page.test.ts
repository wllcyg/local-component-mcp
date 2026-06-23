import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { handleAnalyzePage } from '../src/tools/page.js';

describe('analyze_page tool', () => {
  const workspacePath = path.join(process.cwd(), '.test-page-workspace');

  beforeAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(workspacePath, 'src/views'), { recursive: true });
    fs.mkdirSync(path.join(workspacePath, 'src/components/shared'), { recursive: true });
    fs.mkdirSync(path.join(workspacePath, 'src/components/layout'), { recursive: true });

    // 叶子组件
    fs.writeFileSync(
      path.join(workspacePath, 'src/components/shared/MyButton.vue'),
      '<template><button>btn</button></template>',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(workspacePath, 'src/components/shared/MyInput.vue'),
      '<template><input /></template>',
      'utf-8'
    );

    // 中间层组件（引用叶子组件）
    fs.writeFileSync(
      path.join(workspacePath, 'src/components/layout/SearchBar.vue'),
      `<template>
  <div>
    <MyButton />
    <MyInput />
  </div>
</template>
<script setup>
import MyButton from '../shared/MyButton.vue';
import MyInput from '../shared/MyInput.vue';
</script>`,
      'utf-8'
    );

    // 页面文件（引用中间层组件）
    fs.writeFileSync(
      path.join(workspacePath, 'src/views/HomePage.vue'),
      `<template>
  <div>
    <SearchBar />
    <MyButton />
  </div>
</template>
<script setup>
import SearchBar from '../components/layout/SearchBar.vue';
import MyButton from '../components/shared/MyButton.vue';
</script>`,
      'utf-8'
    );
  });

  afterAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });

  it('应该返回页面的根节点信息', async () => {
    const filePath = path.join(workspacePath, 'src/views/HomePage.vue');
    const result = await handleAnalyzePage({ filePath, workspacePath });
    const data = JSON.parse(result.content[0].text);

    expect(data.pageFile).toBe(filePath);
    expect(data.tree).toBeDefined();
    expect(data.tree.name).toBe('HomePage');
  });

  it('应该递归解析出子组件', async () => {
    const filePath = path.join(workspacePath, 'src/views/HomePage.vue');
    const result = await handleAnalyzePage({ filePath, workspacePath });
    const data = JSON.parse(result.content[0].text);

    const childNames = data.tree.children.map((c: any) => c.name);
    expect(childNames).toContain('SearchBar');
    expect(childNames).toContain('MyButton');
  });

  it('应该递归解析出孙子组件', async () => {
    const filePath = path.join(workspacePath, 'src/views/HomePage.vue');
    const result = await handleAnalyzePage({ filePath, workspacePath });
    const data = JSON.parse(result.content[0].text);

    const searchBar = data.tree.children.find((c: any) => c.name === 'SearchBar');
    expect(searchBar).toBeDefined();
    const grandChildNames = searchBar.children.map((c: any) => c.name);
    expect(grandChildNames).toContain('MyButton');
    expect(grandChildNames).toContain('MyInput');
  });

  it('totalComponents 应该统计去重后的子组件数量', async () => {
    const filePath = path.join(workspacePath, 'src/views/HomePage.vue');
    const result = await handleAnalyzePage({ filePath, workspacePath });
    const data = JSON.parse(result.content[0].text);
    // SearchBar + MyButton + MyInput = 3（MyButton 被两处引用，但去重后只算1个）
    expect(data.totalComponents).toBe(3);
  });

  it('maxDepth=1 应该只解析直接子组件', async () => {
    const filePath = path.join(workspacePath, 'src/views/HomePage.vue');
    const result = await handleAnalyzePage({ filePath, workspacePath, maxDepth: 1 });
    const data = JSON.parse(result.content[0].text);

    const searchBar = data.tree.children.find((c: any) => c.name === 'SearchBar');
    expect(searchBar?.children.length).toBe(0); // 深度限制，不再向下解析
  });
});
