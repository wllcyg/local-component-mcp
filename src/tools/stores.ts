import * as fs from "fs";
import * as path from "path";
import * as babelParser from "@babel/parser";
import _traverse from "@babel/traverse";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { resolveAliasPath, isLikelyAliasPath, findProjectRoot } from "../alias.js";
import { extractImports } from "../utils/imports.js";

const traverse = _traverse.default || _traverse;

function aliasErrHint(original: string): string {
  return isLikelyAliasPath(original)
    ? `（若使用了路径别名，请检查别名配置：tsconfig.json / vite.config.ts / vue.config.js）`
    : "";
}

/** 根据工作区路径智能查找 store 目录，支持多种目录布局 */
function findStoreDirs(workspacePath: string): string[] {
  const candidates = [
    path.join(workspacePath, "src", "store"),
    path.join(workspacePath, "src", "stores"),
    path.join(workspacePath, "store"),
    path.join(workspacePath, "stores"),
  ];

  // 支持 src/modules/*/store 形式的 monorepo 布局
  const modulesDir = path.join(workspacePath, "src", "modules");
  if (fs.existsSync(modulesDir)) {
    try {
      for (const mod of fs.readdirSync(modulesDir)) {
        const storeInMod = path.join(modulesDir, mod, "store");
        if (fs.existsSync(storeInMod) && fs.statSync(storeInMod).isDirectory()) {
          candidates.push(storeInMod);
        }
      }
    } catch { /* 忽略扫描错误 */ }
  }

  return candidates.filter((d) => fs.existsSync(d) && fs.statSync(d).isDirectory());
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build"]);

/** 递归获取目录下所有 .ts/.js/.mts/.cts 文件，跳过无关目录 */
function collectStoreFiles(dir: string): string[] {
  const list: string[] = [];
  const walk = (d: string) => {
    for (const file of fs.readdirSync(d)) {
      const p = path.join(d, file);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        if (!SKIP_DIRS.has(file)) walk(p);
      } else if (/\.(m?[tj]sx?)$/.test(p)) {
        list.push(p);
      }
    }
  };
  walk(dir);
  return list;
}

/**
 * search_stores handler
 * 新增可选 storesPath：直接指定 store 目录；否则自动检测多种目录布局
 */
export async function handleSearchStores(args: any) {
  let workspacePath = String(args?.workspacePath || "");
  const storesPath = args?.storesPath ? String(args.storesPath) : null;
  const original = workspacePath;

  workspacePath = resolveAliasPath(workspacePath, process.cwd());

  if (!fs.existsSync(workspacePath)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `工作区路径不存在：${workspacePath}。${aliasErrHint(original)}`
    );
  }

  let storeFiles: string[] = [];

  if (storesPath) {
    // 用户明确指定了 store 目录
    const resolvedStoresPath = resolveAliasPath(storesPath, workspacePath);
    if (fs.existsSync(resolvedStoresPath)) {
      storeFiles = collectStoreFiles(resolvedStoresPath);
    }
  } else {
    // 自动检测：遍历所有候选目录
    const dirs = findStoreDirs(workspacePath);
    for (const dir of dirs) {
      storeFiles.push(...collectStoreFiles(dir));
    }
    // 去重（多目录可能重叠）
    storeFiles = [...new Set(storeFiles)];
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ count: storeFiles.length, files: storeFiles }, null, 2),
      },
    ],
  };
}

/**
 * get_store_detail handler
 * 新增可选 workspacePath：用于在别名解析时指定项目根目录
 * 支持 Vuex Option Store 和 Pinia Setup Store
 */
export async function handleGetStoreDetail(args: any) {
  let filePath = String(args?.filePath || "");
  const workspacePath = args?.workspacePath ? String(args.workspacePath) : null;
  const original = filePath;

  const resolveBase = workspacePath
    ? workspacePath
    : (findProjectRoot(process.cwd()) ?? process.cwd());

  filePath = resolveAliasPath(filePath, resolveBase);

  if (!fs.existsSync(filePath)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `文件不存在：${filePath}。${aliasErrHint(original)}`
    );
  }

  const code = fs.readFileSync(filePath, "utf-8");
  const ast = babelParser.parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });

  const storeInfo = {
    state: [] as string[],
    getters: [] as string[],
    actions: [] as string[],
    imports: [] as any[],
  };

  storeInfo.imports = extractImports(filePath);

  const fileVariables = new Map<string, any>();

  traverse(ast, {
    // Collect local variables to support referencing declared variables (like RTK initialState)
    VariableDeclarator(p: any) {
      if (p.node.id.type === "Identifier" && p.node.init) {
        fileVariables.set(p.node.id.name, p.node.init);
      }

      // Jotai: const countAtom = atom(...)
      const init = p.node.init;
      if (
        init &&
        init.type === "CallExpression" &&
        init.callee.type === "Identifier" &&
        init.callee.name === "atom" &&
        p.node.id.type === "Identifier"
      ) {
        const name = p.node.id.name;
        const argsList = init.arguments;
        if (argsList.length === 0) {
          storeInfo.state.push(name);
        } else {
          const firstArg = argsList[0];
          if (
            firstArg.type === "ArrowFunctionExpression" ||
            firstArg.type === "FunctionExpression"
          ) {
            storeInfo.getters.push(name);
          } else {
            storeInfo.state.push(name);
          }
          if (argsList.length >= 2) {
            const secondArg = argsList[1];
            if (
              secondArg.type === "ArrowFunctionExpression" ||
              secondArg.type === "FunctionExpression"
            ) {
              storeInfo.actions.push(name);
            }
          }
        }
      }
    },
    // Vuex Option Store: state: { ... } / getters: { ... } / actions: { ... }
    ObjectExpression(p: any) {
      let name = "";
      if (p.parent.type === "VariableDeclarator" && p.parent.id) {
        name = p.parent.id.name;
      } else if (p.parent.type === "ObjectProperty" && p.parent.key) {
        name = p.parent.key.name;
      }
      if (name === "state" || name === "getters" || name === "actions") {
        p.node.properties.forEach((prop: any) => {
          if (prop.key?.name) {
            if (name === "state") storeInfo.state.push(prop.key.name);
            if (name === "getters") storeInfo.getters.push(prop.key.name);
            if (name === "actions") storeInfo.actions.push(prop.key.name);
          }
        });
      }
    },
    // Vuex Option Store: state: () => ({ ... })
    ArrowFunctionExpression(p: any) {
      const name =
        p.parent.type === "ObjectProperty" && p.parent.key ? p.parent.key.name : "";
      if (name === "state" && p.node.body.type === "ObjectExpression") {
        p.node.body.properties.forEach((prop: any) => {
          if (prop.key?.name) storeInfo.state.push(prop.key.name);
        });
      }
    },
    // Pinia, Zustand, Redux Toolkit
    CallExpression(p: any) {
      const callee = p.node.callee;

      // Pinia Setup Store: defineStore('id', () => { ... })
      if (callee.type === "Identifier" && callee.name === "defineStore") {
        let factoryArg = p.node.arguments[1];
        if (
          !factoryArg &&
          p.node.arguments[0] &&
          (p.node.arguments[0].type === "ArrowFunctionExpression" ||
            p.node.arguments[0].type === "FunctionExpression")
        ) {
          factoryArg = p.node.arguments[0];
        }

        if (
          !factoryArg ||
          (factoryArg.type !== "ArrowFunctionExpression" &&
            factoryArg.type !== "FunctionExpression")
        )
          return;

        const body = factoryArg.body;
        if (body.type !== "BlockStatement") return;

        const localDecls = new Map<string, "state" | "getter" | "action">();

        const inspectDeclarator = (decl: any) => {
          if (decl.id?.type !== "Identifier") return;
          const { init } = decl;
          if (!init) return;
          if (init.type === "CallExpression" && init.callee.type === "Identifier") {
            const fn = init.callee.name;
            if (fn === "ref" || fn === "reactive") localDecls.set(decl.id.name, "state");
            else if (fn === "computed") localDecls.set(decl.id.name, "getter");
          } else if (
            init.type === "ArrowFunctionExpression" ||
            init.type === "FunctionExpression"
          ) {
            localDecls.set(decl.id.name, "action");
          }
        };

        body.body.forEach((stmt: any) => {
          if (stmt.type === "VariableDeclaration") {
            stmt.declarations.forEach(inspectDeclarator);
          } else if (stmt.type === "FunctionDeclaration" && stmt.id) {
            localDecls.set(stmt.id.name, "action");
          }
        });

        body.body.forEach((stmt: any) => {
          if (
            stmt.type === "ReturnStatement" &&
            stmt.argument?.type === "ObjectExpression"
          ) {
            stmt.argument.properties.forEach((prop: any) => {
              if (prop.type !== "ObjectProperty") return;
              const key = prop.key.name ?? prop.key.value;
              if (!key) return;
              const kind = localDecls.get(key);
              if (kind === "state") storeInfo.state.push(key);
              else if (kind === "getter") storeInfo.getters.push(key);
              else if (kind === "action") storeInfo.actions.push(key);
              else {
                const v = prop.value;
                if (v?.type === "ArrowFunctionExpression" || v?.type === "FunctionExpression") {
                  storeInfo.actions.push(key);
                } else {
                  storeInfo.state.push(key);
                }
              }
            });
          }
        });
      }

      // Zustand: create(...) or create<T>()(...)
      let isZustand = false;
      let zustandCallback: any = null;
      if (callee.type === "Identifier" && callee.name === "create") {
        isZustand = true;
        zustandCallback = p.node.arguments[0];
      } else if (
        callee.type === "CallExpression" &&
        callee.callee.type === "Identifier" &&
        callee.callee.name === "create"
      ) {
        isZustand = true;
        zustandCallback = p.node.arguments[0];
      }

      if (isZustand && zustandCallback) {
        const parseZustandObject = (objNode: any) => {
          objNode.properties.forEach((prop: any) => {
            if (prop.type === "ObjectMethod") {
              const key = prop.key.name ?? prop.key.value;
              if (key) storeInfo.actions.push(key);
            } else if (prop.type === "ObjectProperty") {
              const key = prop.key.name ?? prop.key.value;
              if (key) {
                const val = prop.value;
                if (
                  val.type === "ArrowFunctionExpression" ||
                  val.type === "FunctionExpression"
                ) {
                  storeInfo.actions.push(key);
                } else {
                  storeInfo.state.push(key);
                }
              }
            }
          });
        };

        if (
          zustandCallback.type === "ArrowFunctionExpression" ||
          zustandCallback.type === "FunctionExpression"
        ) {
          const body = zustandCallback.body;
          if (body.type === "ObjectExpression") {
            parseZustandObject(body);
          } else if (body.type === "BlockStatement") {
            const ret = body.body.find((stmt: any) => stmt.type === "ReturnStatement");
            if (ret && ret.argument && ret.argument.type === "ObjectExpression") {
              parseZustandObject(ret.argument);
            }
          }
        }
      }

      // Redux Toolkit: createSlice(...)
      if (callee.type === "Identifier" && callee.name === "createSlice") {
        const arg = p.node.arguments[0];
        if (arg && arg.type === "ObjectExpression") {
          const initialStateProp = arg.properties.find(
            (prop: any) =>
              (prop.type === "ObjectProperty" || prop.type === "ObjectMethod") &&
              (prop.key.name === "initialState" || prop.key.value === "initialState")
          );
          const reducersProp = arg.properties.find(
            (prop: any) =>
              (prop.type === "ObjectProperty" || prop.type === "ObjectMethod") &&
              (prop.key.name === "reducers" || prop.key.value === "reducers")
          );

          if (initialStateProp && initialStateProp.type === "ObjectProperty") {
            let val = initialStateProp.value;
            if (val.type === "Identifier") {
              const lookedUp = fileVariables.get(val.name);
              if (lookedUp) val = lookedUp;
            }
            if (val.type === "ObjectExpression") {
              val.properties.forEach((prop: any) => {
                const key = prop.key.name ?? prop.key.value;
                if (key) storeInfo.state.push(key);
              });
            }
          }

          if (reducersProp && reducersProp.type === "ObjectProperty") {
            let val = reducersProp.value;
            if (val.type === "Identifier") {
              const lookedUp = fileVariables.get(val.name);
              if (lookedUp) val = lookedUp;
            }
            if (val.type === "ObjectExpression") {
              val.properties.forEach((prop: any) => {
                const key = prop.key.name ?? prop.key.value;
                if (key) storeInfo.actions.push(key);
              });
            }
          }
        }
      }
    },
  });

  storeInfo.state = [...new Set(storeInfo.state)];
  storeInfo.getters = [...new Set(storeInfo.getters)];
  storeInfo.actions = [...new Set(storeInfo.actions)];

  return {
    content: [{ type: "text", text: JSON.stringify(storeInfo, null, 2) }],
  };
}
