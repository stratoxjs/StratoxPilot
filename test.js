import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve, extname } from 'node:path';

// Custom resolver logic
function resolveWithoutExtension(specifier, context, defaultResolve) {
  // Handle relative or absolute paths
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    // Append '.js' if the specifier has no extension
    if (!extname(specifier)) {
      const resolvedSpecifier = `${specifier}.js`;
      return defaultResolve(resolvedSpecifier, context);
    }
  }
  // Use default resolver for other cases
  return defaultResolve(specifier, context);
}

// Register the custom resolver
register('./test.js?'+ Date.now(), pathToFileURL('./').href);

// Export the resolver
export { resolveWithoutExtension as resolve };
