import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';

const packagePath = createRequire(import.meta.url).resolve('@adam0white/human-framework/package.json');
const frameworkVersion = (JSON.parse(readFileSync(packagePath, 'utf8')) as { version: string }).version;

export default defineConfig({
  define: {
    __HUMAN_FRAMEWORK_VERSION__: JSON.stringify(frameworkVersion),
    __MURMUR_BUILD__: JSON.stringify(
      execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim(),
    ),
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  worker: { format: 'es' },
});
