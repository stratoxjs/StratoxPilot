import { describe, expect, test } from 'vitest';
import { Router, Dispatcher } from '../src/index';

// D-049 (V-12): params holds the same keys as vars, each value one plain string:
// percent-decoded, not HTML-escaped, parts of one key joined with "/". vars is unchanged.

/**
 * Match a GET request against a router with one route.
 * @param  {string} pattern
 * @param  {string} uri
 * @return {object} the result of validateDispatch
 */
function matchRoute(pattern, uri) {
  const router = new Router();
  router.get(pattern, 'route');
  return new Dispatcher().validateDispatch(router, 'GET', uri);
}

describe('params', () => {
  test('named parts are strings, keyed by name', () => {
    const result = matchRoute('/{page:product}/{id:[0-9]+}/{slug:[^/]+}', '/product/72/chesterfield');

    expect(result.params).toEqual({ page: 'product', id: '72', slug: 'chesterfield' });
    expect(result.vars).toEqual({ page: ['product'], id: ['72'], slug: ['chesterfield'] });
  });

  test('a catch-all is one string with its parts joined by "/"', () => {
    expect(matchRoute('/shop/{category:.+}', '/shop/furniture/sofas/chesterfield').params)
      .toEqual({ 0: 'shop', category: 'furniture/sofas/chesterfield' });
  });

  test('literal segments are keyed by position, as in vars', () => {
    expect(matchRoute('/about/location', '/about/location').params).toEqual({ 0: 'about', 1: 'location' });
  });

  test('an unnamed regex is keyed by its position, not "" (audit pilot F8, for params)', () => {
    const result = matchRoute('/about/{[a-z]+}', '/about/stockholm');

    expect(result.params).toEqual({ 0: 'about', 1: 'stockholm' });
    expect(result.vars['']).toEqual(['stockholm']);
  });

  test('values are decoded and not HTML-escaped; vars keeps the escaped form', () => {
    const result = matchRoute('/{name:[^/]+}', '/a%26b%20%3Cc%3E');

    expect(result.params.name).toBe('a&b <c>');
    expect(result.vars.name).toEqual(['a&amp;b &lt;c&gt;']);
  });

  test('optional parts that are left out are missing, as in vars', () => {
    const result = matchRoute('/articles/({id:post-[0-9]+})?/({slug:[^/]+})?', '/articles/post-824');

    expect(result.params).toEqual({ 0: 'articles', id: 'post-824' });
  });

  test('a 404 and a 405 have empty params', () => {
    const router = new Router();
    router.post('/form', 'form');
    const dispatcher = new Dispatcher();

    expect(dispatcher.validateDispatch(router, 'GET', '/missing').params).toEqual({});
    expect(dispatcher.validateDispatch(router, 'GET', '/form').params).toEqual({});
  });
});
