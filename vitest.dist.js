import { fileURLToPath } from 'node:url';

const distDir = fileURLToPath(new URL('./dist/', import.meta.url));

/**
 * With `vitest --mode dist` the specs run against the build in dist/ instead of src/ (roadmap 5.1, D-052):
 * an import of "../src/Router" or "../../src/index.js" loads dist/Router.js or dist/index.js.
 * @param  {string} mode  Vitest's mode
 * @return {Array<object>} Vite aliases; none for any other mode
 */
export function distAlias(mode) {
  if (mode !== 'dist') {
    return [];
  }
  return [{ find: /^(?:\.\.\/)+src\/(.+?)(?:\.js)?$/, replacement: `${distDir}$1.js` }];
}
