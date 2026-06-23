import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { handleSearchComponents } from '../src/tools/components.js';

describe('search_components tool', () => {
  const workspacePath = path.join(process.cwd(), '.test-workspace');

  // 测试前的准备：在本地创建一个虚拟的工作区，模拟各种刁钻的组件路径
  beforeAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
    fs.mkdirSync(workspacePath, { recursive: true });

    const dummyFiles = [
      'src/components/MyButton.vue',
      'src/components/ImageUpload/index.vue', // 测试文件夹嵌套 index.vue 的情况
      'src/components/Upload/UploadForm.tsx',
      'src/views/login/index.jsx',
      'package.json' // 防止别名解析报错
    ];

    for (const file of dummyFiles) {
      const fullPath = path.join(workspacePath, file);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, '<template></template>', 'utf-8');
    }
  });

  // 测试完后自动清理虚拟目录
  afterAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });

  it('应该能搜索到所有的组件 (不传 keyword)', async () => {
    const result = await handleSearchComponents({ workspacePath });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.count).toBe(4); // 共有 4 个组件文件 (.vue, .tsx, .jsx)
    expect(data.files).toBeInstanceOf(Array);
  });

  it('应该能精准命中直接命名的组件', async () => {
    const result = await handleSearchComponents({ workspacePath, keyword: 'mybutton' });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.count).toBe(1);
    // 注意不同系统的路径分隔符
    expect(data.files[0].replace(/\\/g, '/')).toContain('src/components/MyButton.vue');
  });

  it('应该能命中文件夹嵌套形式的 index.vue 组件 (重点修复的 Bug)', async () => {
    const result = await handleSearchComponents({ workspacePath, keyword: 'imageupload' });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.count).toBe(1);
    expect(data.files[0].replace(/\\/g, '/')).toContain('src/components/ImageUpload/index.vue');
  });

  it('应该能通过模糊匹配命中相关组件', async () => {
    const result = await handleSearchComponents({ workspacePath, keyword: 'upload' });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.count).toBe(2); // 应该命中 ImageUpload/index.vue 和 Upload/UploadForm.tsx
  });

  it('如果搜不存在的组件应该返回 0', async () => {
    const result = await handleSearchComponents({ workspacePath, keyword: 'notfound' });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.count).toBe(0);
    expect(data.files).toEqual([]);
  });
});
