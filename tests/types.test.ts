import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { handleSearchTypes, handleGetTypeDetail } from '../src/tools/types.js';

describe('types tools', () => {
  const workspacePath = path.join(process.cwd(), '.test-types-workspace');

  beforeAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(workspacePath, 'src/types'), { recursive: true });
    fs.mkdirSync(path.join(workspacePath, 'src/interfaces'), { recursive: true });

    // Interface 定义文件
    fs.writeFileSync(
      path.join(workspacePath, 'src/types/user.ts'),
      `
/** 用户基本信息 */
export interface UserInfo {
  /** 用户唯一标识 */
  id: number;
  /** 用户名 */
  username: string;
  email?: string;
  role: 'admin' | 'user' | 'guest';
}

/** 分页响应体 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
`,
      'utf-8'
    );

    // Type alias 和 enum
    fs.writeFileSync(
      path.join(workspacePath, 'src/types/order.ts'),
      `
/** 订单状态枚举 */
export enum OrderStatus {
  /** 待支付 */
  Pending = 'pending',
  /** 已完成 */
  Completed = 'completed',
  Cancelled = 'cancelled',
}

/** 订单类型别名（联合类型） */
export type OrderType = 'normal' | 'express' | 'pickup';

/** 订单详情 */
export type OrderDetail = {
  orderId: string;
  status: OrderStatus;
  type: OrderType;
  amount: number;
  createdAt?: string;
};
`,
      'utf-8'
    );
  });

  afterAll(() => {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });

  it('search_types 应该找到所有类型定义', async () => {
    const result = await handleSearchTypes({ workspacePath });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBeGreaterThanOrEqual(5); // UserInfo, PaginatedResponse, OrderStatus, OrderType, OrderDetail
    const names = data.types.map((t: any) => t.name);
    expect(names).toContain('UserInfo');
    expect(names).toContain('OrderStatus');
    expect(names).toContain('OrderType');
    expect(names).toContain('OrderDetail');
  });

  it('search_types keyword 过滤应正常工作', async () => {
    const result = await handleSearchTypes({ workspacePath, keyword: 'order' });
    const data = JSON.parse(result.content[0].text);
    expect(data.types.every((t: any) =>
      t.name.toLowerCase().includes('order') ||
      t.relativeFilePath.toLowerCase().includes('order')
    )).toBe(true);
  });

  it('search_types 应返回正确的 kind', async () => {
    const result = await handleSearchTypes({ workspacePath });
    const data = JSON.parse(result.content[0].text);
    const userInfo = data.types.find((t: any) => t.name === 'UserInfo');
    const orderStatus = data.types.find((t: any) => t.name === 'OrderStatus');
    const orderType = data.types.find((t: any) => t.name === 'OrderType');
    expect(userInfo?.kind).toBe('interface');
    expect(orderStatus?.kind).toBe('enum');
    expect(orderType?.kind).toBe('type');
  });

  it('get_type_detail 应提取 interface 成员', async () => {
    const filePath = path.join(workspacePath, 'src/types/user.ts');
    const result = await handleGetTypeDetail({ filePath, typeName: 'UserInfo' });
    const data = JSON.parse(result.content[0].text);
    expect(data.definitions.length).toBe(1);
    const def = data.definitions[0];
    expect(def.name).toBe('UserInfo');
    expect(def.kind).toBe('interface');
    expect(def.members.length).toBe(4); // id, username, email, role

    const email = def.members.find((m: any) => m.name === 'email');
    expect(email?.optional).toBe(true);

    const id = def.members.find((m: any) => m.name === 'id');
    expect(id?.type).toBe('number');
  });

  it('get_type_detail 应提取 enum 成员及其值', async () => {
    const filePath = path.join(workspacePath, 'src/types/order.ts');
    const result = await handleGetTypeDetail({ filePath, typeName: 'OrderStatus' });
    const data = JSON.parse(result.content[0].text);
    const def = data.definitions[0];
    expect(def.kind).toBe('enum');
    const memberNames = def.members.map((m: any) => m.name);
    expect(memberNames).toContain('Pending');
    expect(memberNames).toContain('Completed');
    expect(memberNames).toContain('Cancelled');
  });

  it('get_type_detail 应提取 type alias 的对象成员', async () => {
    const filePath = path.join(workspacePath, 'src/types/order.ts');
    const result = await handleGetTypeDetail({ filePath, typeName: 'OrderDetail' });
    const data = JSON.parse(result.content[0].text);
    const def = data.definitions[0];
    expect(def.kind).toBe('type');
    expect(def.members.length).toBeGreaterThan(0);
    const memberNames = def.members.map((m: any) => m.name);
    expect(memberNames).toContain('orderId');
    expect(memberNames).toContain('status');
  });

  it('get_type_detail 未找到类型名时应抛出错误', async () => {
    const filePath = path.join(workspacePath, 'src/types/user.ts');
    await expect(
      handleGetTypeDetail({ filePath, typeName: 'NonExistentType' })
    ).rejects.toThrow();
  });
});
