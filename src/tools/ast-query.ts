import { findInFiles, parseAsync } from '@ast-grep/napi';
import fg from 'fast-glob';
import fs from 'fs/promises';
import { parse as parseVue } from '@vue/compiler-sfc';
import path from 'path';

export async function handleQueryAst(args: any) {
  const { workspacePath, pattern, language } = args;

  if (!workspacePath || !pattern || !language) {
    throw new Error('Missing required arguments: workspacePath, pattern, or language');
  }

  try {
    const config = {
      paths: [workspacePath],
      matcher: {
        rule: { pattern },
      },
    };

    const results: any[] = [];
    
    // Normalize language string
    let finalLang = language.charAt(0).toUpperCase() + language.slice(1).toLowerCase();
    if (finalLang === 'Javascript') finalLang = 'JavaScript';
    if (finalLang === 'Typescript') finalLang = 'TypeScript';

    // 1. Run standard ast-grep for native files
    await findInFiles(finalLang, config, (err, nodes) => {
      if (err) return;
      for (const node of nodes) {
        results.push({
          file: node.getRoot().filename(),
          text: node.text()
        });
      }
    });

    // 2. Custom handling for .vue files
    const vueFiles = await fg('**/*.vue', {
      cwd: workspacePath,
      ignore: ['**/node_modules/**', '**/dist/**'],
      absolute: true
    });

    for (const vueFile of vueFiles) {
      try {
        const content = await fs.readFile(vueFile, 'utf-8');
        const { descriptor } = parseVue(content);

        let blocksToParse: string[] = [];

        if (finalLang === 'Html' && descriptor.template) {
          blocksToParse.push(descriptor.template.content);
        } else if (['JavaScript', 'TypeScript', 'Tsx'].includes(finalLang)) {
          if (descriptor.script) blocksToParse.push(descriptor.script.content);
          if (descriptor.scriptSetup) blocksToParse.push(descriptor.scriptSetup.content);
        }

        for (const blockContent of blocksToParse) {
          if (!blockContent.trim()) continue;
          
          const root = await parseAsync(finalLang, blockContent);
          const nodes = root.root().findAll({ rule: { pattern } });
          
          for (const node of nodes) {
            results.push({
              file: vueFile,
              text: node.text()
            });
          }
        }
      } catch (e) {
        // Ignore parse errors for individual vue files
      }
    }

    const limitedResults = results.slice(0, 50);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            totalFound: results.length,
            showing: limitedResults.length,
            results: limitedResults
          }, null, 2)
        }
      ]
    };
  } catch (error: any) {
    throw new Error(`AST Query failed: ${error.message}`);
  }
}
