// Lets scripts/dev-api.mjs import the api/ handlers exactly as Vercel runs them.
//
// Vercel's node runtime rejects explicit `.ts` import extensions, so the handlers
// use extensionless relative imports. Node's type stripping cannot resolve those
// on its own — hence this hook: try normally, and on failure retry with `.ts`.
//
// The point is that ONE copy of each handler serves both, so what runs locally is
// what runs in production.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) {
      return next(`${specifier}.ts`, context);
    }
    throw error;
  }
}
