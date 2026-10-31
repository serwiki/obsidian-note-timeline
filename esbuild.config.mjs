import esbuild from 'esbuild';
const watch = process.argv.includes('--watch');
const options = {
  entryPoints: ['src/main.ts'], bundle: true, external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'],
  format: 'cjs', platform: 'browser', target: 'es2020', outfile: 'main.js', sourcemap: watch ? 'inline' : false,
  logLevel: 'info'
};
if (watch) {const ctx = await esbuild.context(options); await ctx.watch();}
else await esbuild.build(options);
