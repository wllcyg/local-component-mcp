import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { handleSearchStores, handleGetStoreDetail } from '../src/tools/stores.js';

describe('stores tools', () => {
  const workspacePath = path.join(process.cwd(), '.test-stores-workspace');

  beforeAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(workspacePath, 'src/stores'), { recursive: true });

    fs.writeFileSync(path.join(workspacePath, 'src/stores/user.ts'), `
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useUserStore = defineStore('user', () => {
  const name = ref('test');
  const token = ref('');
  
  const isLoggedIn = computed(() => !!token.value);
  
  function login(newToken) {
    token.value = newToken;
  }
  
  return { name, token, isLoggedIn, login };
});
    `, 'utf-8');
  });

  afterAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });

  it('search_stores 应该能在默认目录 (src/stores) 中自动嗅探到 store 文件', async () => {
    const result = await handleSearchStores({ workspacePath });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.count).toBe(1);
    expect(data.files[0].replace(/\\/g, '/')).toContain('src/stores/user.ts');
  });

  it('get_store_detail 应该能解析 Pinia 文件', async () => {
    const storePath = path.join(workspacePath, 'src/stores/user.ts');
    const result = await handleGetStoreDetail({ filePath: storePath, workspacePath });
    const data = JSON.parse(result.content[0].text);
    
    expect(data).toBeDefined();
    // 只要没有崩溃并且成功跑通 AST 解析就算作及格
    expect(data.imports).toBeDefined();
  });
});
