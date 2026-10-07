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
  ])('returns 404 for the malformed encoding $uri on route $pattern (audit pilot F7, fixed)', ({ pattern, uri }) => {
    expect(matchRoute(pattern, uri).status).toBe(404);
  });

  test('gives a malformed URI to the error route (audit pilot F7, fixed)', () => {
    const router = new Router();
    router.get('/{page:.+}', 'catch-all');
    router.get('[STATUS_ERROR]', 'error');

    const result = new Dispatcher().validateDispatch(router, 'GET', '/%');

    expect(result.status).toBe(404);
    expect(result.controller).toBe('error');
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

  test('keeps | as it is (audit pilot F6, | fixed)', () => {
    expect(matchRoute('/{name:[^/]+}', '/a|b').vars.name).toEqual(['a|b']);
  });

  test('a literal route containing & matches the URI as it reads (D-048)', () => {
    expect(matchRoute('/a&b', '/a&b').status).toBe(200);
    expect(matchRoute('/a&b', '/a%26b').status).toBe(200);
  });

  test('a literal route written escaped no longer matches (D-048)', () => {
    expect(matchRoute('/a&amp;b', '/a&b').status).toBe(404);
  });
});

// A literal segment matches the same text exactly; only {name:regex} is a regular expression (D-048).
describe('regex characters in literal segments (audit pilot F5, fixed, D-048)', () => {
  test('. in a literal is a dot', () => {
    expect(matchRoute('/file.txt', '/file.txt').status).toBe(200);
    expect(matchRoute('/file.txt', '/fileXtxt').status).toBe(404);
  });

  test('parentheses in a literal are parentheses', () => {
    expect(matchRoute('/a(b)', '/a(b)').status).toBe(200);
    expect(matchRoute('/a(b)', '/ab').status).toBe(404);
  });

  test('/c++ matches /c++ and nothing else', () => {
    expect(matchRoute('/c++', '/c++').status).toBe(200);
    expect(matchRoute('/c++', '/c').status).toBe(404);
    expect(matchRoute('/c++', '/other').status).toBe(404);
  });

  test('a literal is case-sensitive and whole: /about matches neither /About nor /aboutus', () => {
    expect(matchRoute('/about', '/About').status).toBe(404);
    expect(matchRoute('/about', '/aboutus').status).toBe(404);
  });

  test('routes after a literal that is not a valid regex still match', () => {
    const router = new Router();
    router.get('/c++', 'invalid');
    router.get('/other', 'other');

    expect(new Dispatcher().validateDispatch(router, 'GET', '/other').controller).toBe('other');
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

// Roadmap 4.1 compiles each route once; these pin down when the old code built the regular
// expressions, so an invalid one still fails exactly where it did.
describe('an invalid regular expression inside braces', () => {
  test('throws a SyntaxError for every dispatch that reaches it (guard, roadmap 4.1)', () => {
    const router = new Router();
    router.get('/{id:[0-9}', 'invalid');
    const dispatcher = new Dispatcher();

    expect(() => dispatcher.validateDispatch(router, 'GET', '/1')).toThrow(SyntaxError);
    expect(() => dispatcher.validateDispatch(router, 'GET', '/1')).toThrow(SyntaxError);
  });

  test('does not throw when an earlier route matches the whole path (guard, roadmap 4.1)', () => {
    const router = new Router();
    router.get('/a', 'a');
    router.get('/{id:[0-9}', 'invalid');

    expect(new Dispatcher().validateDispatch(router, 'GET', '/a').controller).toBe('a');
  });

  test('does not throw when an earlier segment of the route fails (guard, roadmap 4.1)', () => {
    expect(matchRoute('/shop/{id:[0-9}', '/other').status).toBe(404);
  });

  test('does not throw for a route with another verb (guard, roadmap 4.1)', () => {
    const router = new Router();
    router.post('/{id:[0-9}', 'invalid');

    expect(new Dispatcher().validateDispatch(router, 'GET', '/1').status).toBe(404);
  });
});

describe('one dispatcher, several dispatches', () => {
  test('a route added after the first dispatch matches on the next one (guard, roadmap 4.1)', () => {
    const router = new Router();
    router.get('/a', 'a');
    const dispatcher = new Dispatcher();
    const before = dispatcher.validateDispatch(router, 'GET', '/b');
    router.get('/b', 'b');

    expect(before.status).toBe(404);
    expect(dispatcher.validateDispatch(router, 'GET', '/b').controller).toBe('b');
  });

  test('the same pattern in two routers matches in both (guard, roadmap 4.1)', () => {
    const first = new Router();
    first.get('/{id:[0-9]+}', 'first');
    const second = new Router();
    second.get('/{id:[0-9]+}', 'second');
    const dispatcher = new Dispatcher();

    expect(dispatcher.validateDispatch(first, 'GET', '/1').vars).toEqual({ id: ['1'] });
    expect(dispatcher.validateDispatch(second, 'GET', '/2')).toMatchObject({ controller: 'second', vars: { id: ['2'] } });
  });
});
