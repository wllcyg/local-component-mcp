import { describe, it, expect, vi } from 'vitest';
import { handleQueryAst } from '../src/tools/ast-query';

// Mock @ast-grep/napi
vi.mock('@ast-grep/napi', () => ({
  findInFiles: vi.fn((lang, config, cb) => {
    cb(null, [
      {
        text: () => 'axios.get("/api/users")',
        getRoot: () => ({ filename: () => 'src/api/user.ts' })
      },
      {
        text: () => 'axios.get("/api/roles")',
        getRoot: () => ({ filename: () => 'src/api/role.ts' })
      }
    ]);
    return Promise.resolve(2);
  })
}));

describe('AST Query Tool', () => {
  it('should throw if missing required arguments', async () => {
    await expect(handleQueryAst({ workspacePath: 'foo' })).rejects.toThrow(/Missing required arguments/);
  });

  it('should query ast and format results correctly', async () => {
    const result = await handleQueryAst({
      workspacePath: '/my/workspace',
      pattern: 'axios.get($URL)',
      language: 'typescript'
    });

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');

    const data = JSON.parse(result.content[0].text);
    expect(data.totalFound).toBe(2);
    expect(data.results[0].text).toBe('axios.get("/api/users")');
    expect(data.results[0].file).toBe('src/api/user.ts');
  });
});
