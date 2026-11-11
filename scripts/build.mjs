import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build as bundle } from 'esbuild';
import { build as viteBuild } from 'vite';

const visitor = resolve('dist');
const admin = resolve('build/apps-script/admin');
const publicApp = resolve('build/apps-script/public');
await rm(resolve('build/apps-script'), { recursive: true, force: true });
await Promise.all([mkdir(admin, { recursive: true }), mkdir(publicApp, { recursive: true })]);

const escapeScript = (source) => source.replace(/<\/script/gi, '<\\/script');
const escapeStyle = (source) => source.replace(/<\/style/gi, '<\\/style');
async function adminHtml() {
  const output = await bundle({
    entryPoints: ['apps/admin/main.tsx'], bundle: true, write: false, outdir: 'inline',
    platform: 'browser', format: 'iife', target: 'es2020', minify: true, legalComments: 'none', jsx: 'automatic',
    define: { 'import.meta.env.DEV': 'false', 'import.meta.env.MODE': '"production"', 'process.env.NODE_ENV': '"production"' },
  });
  const js = output.outputFiles.find((file) => file.path.endsWith('.js'))?.text;
  const css = output.outputFiles.find((file) => file.path.endsWith('.css'))?.text;
  if (!js || !css) throw new Error('Yönetim arayüzü JavaScript veya CSS çıktısı eksik.');
  const template = await readFile('admin.html', 'utf8');
  const html = template.replace('</head>', () => '<base target="_top"><style>' + escapeStyle(css) + '</style></head>')
    .replace(/<script type="module" src="[^"]+"><\/script>/, () => '<script>' + escapeScript(js) + '</script>');
  await writeFile(resolve(admin, 'Index.html'), html);
}
async function gas(name, out, functions) {
  const output = await bundle({
    entryPoints: ['gas/' + name + '/main.ts'], bundle: true, write: false,
    platform: 'neutral', format: 'iife', globalName: 'CalcomateSidesGas', target: 'es2020', legalComments: 'none',
  });
  const bindings = Object.entries(functions).map(([fn, args]) =>
    'function ' + fn + '(' + args + ') { return CalcomateSidesGas.' + fn + '(' + args + '); }').join('\n');
  await writeFile(resolve(out, 'Code.gs'), output.outputFiles[0].text + '\n' + bindings + '\n');
  await copyFile('gas/' + name + '/appsscript.json', resolve(out, 'appsscript.json'));
}

await Promise.all([
  viteBuild({ mode: 'production', build: { outDir: visitor, emptyOutDir: true, rollupOptions: { input: resolve('index.html') } } }),
  adminHtml(),
  gas('admin', admin, { doGet: '', adminQuery: 'name, params', adminMutate: 'input' }),
  gas('public', publicApp, { doGet: '' }),
]);
console.log('Ziyaretçi sitesi: dist/ · Apps Script: build/apps-script/{admin,public}/');
