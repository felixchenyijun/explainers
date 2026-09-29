import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
const output=new URL('../index.html',import.meta.url);
const compiled=await build({entryPoints:[new URL('./app.js',import.meta.url).pathname],bundle:true,minify:true,format:'iife',write:false,legalComments:'inline',target:'es2022'});
const template=await readFile(new URL('./template.txt',import.meta.url),'utf8');
const notice=await readFile(new URL('../THIRD-PARTY-NOTICES.txt',import.meta.url),'utf8');
const bundle=compiled.outputFiles[0].text.replaceAll('</script','<\\/script');
await writeFile(output,template.replace('/* APP_BUNDLE */',()=>bundle).replace('</head>',`<!--\n${notice}\n-->\n</head>`));
console.log('Built inference-studio/index.html');
