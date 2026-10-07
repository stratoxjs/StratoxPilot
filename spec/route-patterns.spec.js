import { describe, expect, test } from 'vitest';
import { Router, Dispatcher } from '../src/index';

/**
 * Match a GET request against a router that has only one route,
 * so the result depends on that route's pattern alone.
 * @param  {string} pattern
 * @param  {string} uri
 * @return {object} the result of validateDispatch
 */
function matchRoute(pattern, uri) {
  const router = new Router();
  router.get(pattern, 'route');
  return new Dispatcher().validateDispatch(router, 'GET', uri);
}

// One row per feature in the route pattern table of docs/audit/pilot.md, using the
// patterns from the docs ("Add routes"). Literal segments are stored in vars under
// their position, counted from 0 after the leading slash. Vitest shortens each
// interpolated value in a test name to 40 characters, so keep `feature` short.
describe('route patterns that match', () => {
  test.each([
    {
      feature: 'literal segments',
      pattern: '/about/contact',
      uri: '/about/contact',
      path: ['about', 'contact'],
      vars: { 0: ['about'], 1: ['contact'] },
    },
    // The value of an unnamed regex is stored under the key ''.
    {
      feature: 'unnamed regex (audit pilot F8)',
      pattern: '/about/location/{[a-z]+}',
      uri: '/about/location/stockholm',
      path: ['about', 'location', 'stockholm'],
      vars: { 0: ['about'], 1: ['location'], '': ['stockholm'] },
    },
    {
      feature: 'named regex',
      pattern: '/{page:about}/location/{city:[^/]+}',
      uri: '/about/location/stockholm',
      path: ['about', 'location', 'stockholm'],
      vars: { page: ['about'], 1: ['location'], city: ['stockholm'] },
    },
    {
      feature: 'named regex',
      pattern: '/{page:about}/location/{city:[^/]+}',
      uri: '/about/location/new-york',
      path: ['about', 'location', 'new-york'],
      vars: { page: ['about'], 1: ['location'], city: ['new-york'] },
    },
    {
      feature: 'key over several segments',
      pattern: '/{page:about/location}',
      uri: '/about/location',
      path: ['about', 'location'],
      vars: { page: ['about', 'location'] },
    },
    {
      feature: 'prefix + regex',
      pattern: '/articles/{id:post-[0-9]+}/{slug:[^/]+}',
      uri: '/articles/post-824/hello-world',
      path: ['articles', 'post-824', 'hello-world'],
      vars: { 0: ['articles'], id: ['post-824'], slug: ['hello-world'] },
    },
    {
      feature: 'catch-all, one segment',
      pattern: '/shop/{category:.+}',
      uri: '/shop/furniture',
      path: ['shop', 'furniture'],
      vars: { 0: ['shop'], category: ['furniture'] },
    },
    {
      feature: 'catch-all, nested segments',
      pattern: '/shop/{category:.+}',
      uri: '/shop/furniture/sofas/chesterfield',
      path: ['shop', 'furniture', 'sofas', 'chesterfield'],
      vars: { 0: ['shop'], category: ['furniture', 'sofas', 'chesterfield'] },
    },
    {
      feature: 'optional segments, both left out',
      pattern: '/articles/({id:post-[0-9]+})?/({slug:[^/]+})?',
      uri: '/articles',
      path: ['articles'],
      vars: { 0: ['articles'] },
    },
    {
      feature: 'optional segments, only the first given',
      pattern: '/articles/({id:post-[0-9]+})?/({slug:[^/]+})?',
      uri: '/articles/post-824',
      path: ['articles', 'post-824'],
      vars: { 0: ['articles'], id: ['post-824'] },
    },
    {
      feature: 'optional segments, both given',
      pattern: '/articles/({id:post-[0-9]+})?/({slug:[^/]+})?',
      uri: '/articles/post-824/hello-world',
      path: ['articles', 'post-824', 'hello-world'],
      vars: { 0: ['articles'], id: ['post-824'], slug: ['hello-world'] },
    },
    {
      feature: 'optional segments, only the second given',
      pattern: '/articles/({id:post-[0-9]+})?/({slug:[^/]+})?',
      uri: '/articles/hello-world',
      path: ['articles', 'hello-world'],
      vars: { 0: ['articles'], slug: ['hello-world'] },
    },
  ])('$feature: $pattern matches $uri', ({ pattern, uri, path, vars }) => {
    const result = matchRoute(pattern, uri);

    expect(result.status).toBe(200);
    expect(result.controller).toBe('route');
    expect(result.path).toEqual(path);
    expect(result.vars).toEqual(vars);
  });
});

// Only the status is asserted here. What else a 404 response contains (D-048) is
// covered with the status handling tests.
describe('route patterns that do not match', () => {
  test.each([
    { feature: 'literal segments', pattern: '/about/contact', uri: '/about' },
    { feature: 'literal segments', pattern: '/about/contact', uri: '/about/other' },
    { feature: 'literal segments', pattern: '/about/contact', uri: '/about/contact/extra' },
    { feature: 'unnamed regex', pattern: '/about/location/{[a-z]+}', uri: '/about/location/123' },
    { feature: 'named regex', pattern: '/{page:about}/location/{city:[^/]+}', uri: '/other/location/stockholm' },
    { feature: 'named regex', pattern: '/{page:about}/location/{city:[^/]+}', uri: '/about/location/a/b' },
    { feature: 'key over several segments', pattern: '/{page:about/location}', uri: '/about' },
    { feature: 'key over several segments', pattern: '/{page:about/location}', uri: '/about/other' },
    { feature: 'prefix + regex', pattern: '/articles/{id:post-[0-9]+}/{slug:[^/]+}', uri: '/articles/824/hello-world' },
    { feature: 'prefix + regex', pattern: '/articles/{id:post-[0-9]+}/{slug:[^/]+}', uri: '/articles/xpost-824/hello-world' },
    { feature: 'optional segments', pattern: '/articles/({id:post-[0-9]+})?/({slug:[^/]+})?', uri: '/articles/post-824/hello-world/extra' },
    { feature: 'catch-all needs at least one part (audit pilot F20, fixed, D-048)', pattern: '/shop/{category:.+}', uri: '/shop' },
  ])('$feature: $pattern does not match $uri', ({ pattern, uri }) => {
    expect(matchRoute(pattern, uri).status).toBe(404);
  });
});
