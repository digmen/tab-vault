import * as esbuild from 'esbuild';
import { cp, rm } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
const outdir = 'dist';

// Static files copied verbatim into dist/ so the whole extension loads from one folder.
const STATIC = ['manifest.json', 'popup.html', 'popup.css', '_locales', 'icons'];

async function copyStatic() {
  await Promise.all(
    STATIC.map((name) => cp(name, `${outdir}/${name}`, { recursive: true }))
  );
}

// Rebuild static assets whenever esbuild finishes a (re)build.
const copyPlugin = {
  name: 'copy-static',
  setup(build) {
    build.onEnd(() => copyStatic());
  },
};

await rm(outdir, { recursive: true, force: true });

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/background.ts', 'src/popup.ts'],
  bundle: true,
  outdir,
  format: 'iife',
  target: 'chrome110',
  minify: !watch,
  sourcemap: watch,
  logLevel: 'info',
  plugins: [copyPlugin],
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching for changes… (load the "dist" folder as an unpacked extension)');
} else {
  await esbuild.build(options);
  console.log('built to dist/ — load that folder as an unpacked extension');
}
