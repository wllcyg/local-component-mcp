import { findInFiles } from '@ast-grep/napi';

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
    
    // Normalize language string (e.g., typescript -> TypeScript, javascript -> JavaScript)
    let finalLang = language.charAt(0).toUpperCase() + language.slice(1).toLowerCase();
    if (finalLang === 'Javascript') finalLang = 'JavaScript';
    if (finalLang === 'Typescript') finalLang = 'TypeScript';

    await findInFiles(finalLang, config, (err, nodes) => {
      if (err) return;
      for (const node of nodes) {
        results.push({
          file: node.getRoot().filename(),
          text: node.text()
        });
      }
    });

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
