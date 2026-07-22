// Metro config — exists for ONE reason. Do not "clean this up".
//
// THE FAILURE THIS PREVENTS (cost an hour of debugging, shipped broken once):
//   Uncaught SyntaxError: Cannot use 'import.meta' outside a module
//
// zustand's ESM build uses `import.meta.env` in its devtools middleware, and
// `zustand/middleware` re-exports devtools alongside persist — so importing
// persist drags import.meta in. Expo's web export emits a classic
// `<script defer>`, NOT `type="module"`, so the ENTIRE bundle fails to parse.
// React never hydrates.
//
// The vicious part: the page still looks perfect. Expo pre-renders static HTML,
// so you get correct text and correct layout with zero interactivity. HTTP 200,
// right words on screen, typecheck green, lint green, `expo export` green.
// Only the browser console knows. That is what `scripts/check-web.sh` is for.
//
// Fix: on web only, resolve zustand to its CommonJS entries, which have no
// import.meta. Native is unaffected (it never had the problem).
const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const config = getDefaultConfig(__dirname);

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && (moduleName === 'zustand' || moduleName.startsWith('zustand/'))) {
    const sub = moduleName === 'zustand' ? 'index' : moduleName.slice('zustand/'.length);
    const cjs = path.join(__dirname, 'node_modules', 'zustand', `${sub}.js`);
    // Guarded: if zustand ever changes layout, fall through to the default
    // resolver rather than hard-failing the bundle.
    if (fs.existsSync(cjs)) return { type: 'sourceFile', filePath: cjs };
  }
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
