import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { handleGetComponentDetail } from '../src/tools/components.js';

describe('get_component_detail tool', () => {
  const workspacePath = path.join(process.cwd(), '.test-detail-workspace');
  const vueFilePath = path.join(workspacePath, 'Button.vue');
  const errFilePath = path.join(workspacePath, 'Error.vue');

  beforeAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
    fs.mkdirSync(workspacePath, { recursive: true });

    // Mock 一个标准的 Vue 组件
    fs.writeFileSync(vueFilePath, `
<template><button @click="handleClick">{{ text }}</button></template>
<script setup lang="ts">
const props = defineProps({
  text: { type: String, required: true }
});
const emit = defineEmits(['click']);
function handleClick() { emit('click'); }
</script>
    `, 'utf-8');

    // Mock 一个有语法错误的文件
    fs.writeFileSync(errFilePath, `<template><div></template><script>const a =</script>`, 'utf-8');
  });

  afterAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });

  it('应该能精准解析 Vue 组件的 Props 和 Emits', async () => {
    const result = await handleGetComponentDetail({ filePath: vueFilePath, workspacePath });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.props).toBeDefined();
    expect(data.props[0].name).toBe('text');
    expect(data.props[0].required).toBe(true);
    expect(data.events).toBeDefined();
    expect(data.events[0].name).toBe('click');
  });

  it('如果代码有语法错误，应该优雅降级返回错误信息，而不是让服务器崩溃', async () => {
    const result = await handleGetComponentDetail({ filePath: errFilePath, workspacePath });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.__failedToDocgen).toBe(true);
    expect(data.__error).toBeDefined();
  });
});
