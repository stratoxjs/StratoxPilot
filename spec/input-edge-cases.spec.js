import { describe, expect, test } from 'vitest';
import { Router, Dispatcher } from '../src/index';

/**
 * Match a GET request against a router that has only one route.
 * @param  {string} pattern
 * @param  {string} uri
 * @return {object} the result of validateDispatch
 */
function matchRoute(pattern, uri) {
  const router = new Router();
  router.get(pattern, 'route');
  return new Dispatcher().validateDispatch(router, 'GET', uri);
}

describe('percent-encoding and plain special characters', () => {
  test.each([
    { uri: '/hello%20world', value: 'hello world' },
    { uri: '/hello world', value: 'hello world' },
    { uri: '/caf%C3%A9', value: 'café' },
    { uri: '/café', value: 'café' },
    { uri: '/a+b', value: 'a+b' },
  ])('decodes $uri to $value', ({ uri, value }) => {
    const result = matchRoute('/{name:[^/]+}', uri);

    expect(result.status).toBe(200);
    expect(result.vars.name).toEqual([value]);
  });

  test('returns 404 for an encoded slash on a [^/]+ route (audit pilot F22)', () => {
    expect(matchRoute('/{name:[^/]+}', '/a%2Fb').status).toBe(404);
  });

  test('keeps an encoded slash inside one vars item for .+ (audit pilot F22)', () => {
    const result = matchRoute('/{name:.+}', '/a%2Fb');

    expect(result.status).toBe(200);
    expect(result.vars.name).toEqual(['a/b']);
  });

  test.each([
    { pattern: '/{name:[^/]+}', uri: '/%E0%A4%A' },
    { pattern: '/{name:[^/]+}', uri: '/%' },
    { pattern: '/about', uri: '/%' },
  ])('throws URIError for the malformed encoding $uri on route $pattern (audit pilot F7)', ({ pattern, uri }) => {
    expect(() => matchRoute(pattern, uri)).toThrow(URIError);
  });
});

// URI parts are HTML-escaped before they are matched, so vars hold escaped text
// and patterns have to match the escaped form.
describe('HTML escaping of URI parts (audit pilot F6)', () => {
  test.each([
    { uri: '/<b>', value: '&lt;b&gt;' },
    { uri: '/%3Cb%3E', value: '&lt;b&gt;' },
    { uri: '/a&b', value: 'a&amp;b' },
    { uri: "/it's", value: 'it&#39;s' },
    { uri: '/say%22hi%22', value: 'say&quot;hi&quot;' },
  ])('stores $uri as $value in vars', ({ uri, value }) => {
    expect(matchRoute('/{name:[^/]+}', uri).vars.name).toEqual([value]);
  });

  test('turns | into the text "undefined"', () => {
    expect(matchRoute('/{name:[^/]+}', '/a|b').vars.name).toEqual(['aundefinedb']);
  });

  test('does not match a literal route containing & against the same URI', () => {
    expect(matchRoute('/a&b', '/a&b').status).toBe(404);
  });

  test('matches a literal route containing & only when the route is written escaped', () => {
    expect(matchRoute('/a&amp;b', '/a&b').status).toBe(200);
  });
});

// Every literal segment is used as a regular expression.
describe('regex characters in literal segments (audit pilot F5)', () => {
  test('lets . in a literal match any character', () => {
    expect(matchRoute('/file.txt', '/file.txt').status).toBe(200);
    expect(matchRoute('/file.txt', '/fileXtxt').status).toBe(200);
  });

  test('treats parentheses in a literal as a group', () => {
    expect(matchRoute('/a(b)', '/ab').status).toBe(200);
    expect(matchRoute('/a(b)', '/a(b)').status).toBe(404);
  });

  test.each(['/c++', '/other'])('throws SyntaxError for %s when a route is the literal /c++', (uri) => {
    expect(() => matchRoute('/c++', uri)).toThrow(SyntaxError);
  });
});

// The URI is matched as given: no trailing-slash, leading-slash, double-slash or
// case normalization.
describe('URI form is not normalized (audit pilot F23)', () => {
  test.each([
    { pattern: '/about', uri: '/about/' },
    { pattern: '/about', uri: 'about' },
    { pattern: '/about', uri: '//about' },
    { pattern: '/about', uri: '/About' },
    { pattern: '/shop/{category:.+}', uri: '/shop/' },
    { pattern: '/', uri: '' },
  ])('returns 404 for "$uri" on route $pattern', ({ pattern, uri }) => {
    expect(matchRoute(pattern, uri).status).toBe(404);
  });
});
