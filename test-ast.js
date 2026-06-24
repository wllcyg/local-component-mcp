import { findInFiles } from '@ast-grep/napi';

async function test() {
  const config = {
    paths: ['e:/售后项目/ai-robot-web/src/views/self-service/entry-management/index.vue'],
    matcher: { rule: { pattern: "const $A = ref($B)" } },
    languageGlobs: ['*.vue']
  };
  
  await findInFiles('JavaScript', config, (err, nodes) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(`Found ${nodes.length} nodes`);
    for (const node of nodes) {
      console.log(node.text());
    }
  });
}

test();
