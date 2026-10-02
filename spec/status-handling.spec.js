import { describe, expect, test } from 'vitest';
import { Router, Dispatcher } from '../src/index';

/**
 * Dispatch one request against a router.
 * @param  {Router} router
 * @param  {string} method
 * @param  {string} uri
 * @return {object} the result of validateDispatch
 */
function dispatch(router, method, uri) {
  return new Dispatcher().validateDispatch(router, method, uri);
}

describe('404 Not Found', () => {
  test('returns 404 and controller null when no route matches', () => {
    const router = new Router();
    router.get('/', 'start');

    const result = dispatch(router, 'GET', '/missing');

    expect(result.status).toBe(404);
    expect(result.controller).toBeNull();
    expect(result.config).toBeNull();
  });

  test('returns the partially matched controller when there is no error route (audit pilot F3)', () => {
    const router = new Router();
    router.get('/about', 'about');

    const result = dispatch(router, 'GET', '/about/extra');

    expect(result.status).toBe(404);
    expect(result.controller).toBe('about');
    expect(result.config).toEqual({});
  });

  test('takes path and vars from the last route tried, not from the returned controller (audit pilot F21)', () => {
    const router = new Router();
    router.get('/about', 'about');
    router.get('/contact', 'contact');

    const result = dispatch(router, 'GET', '/about/extra');

    expect(result.status).toBe(404);
    expect(result.controller).toBe('about');
    expect(result.path).toEqual([]);
    expect(result.vars).toEqual({});
  });

  test('returns 404, not 405, for a GET request to a POST-only path (audit pilot F12)', () => {
    const router = new Router();
    router.post('/form', 'form');

    const result = dispatch(router, 'GET', '/form');

    expect(result.status).toBe(404);
    expect(result.controller).toBeNull();
  });
});

describe('405 Method Not Allowed', () => {
  test('returns 405 and controller null for a POST request to a GET-only path', () => {
    const router = new Router();
    router.get('/about', 'about');
    router.post('/form', 'form');

    const result = dispatch(router, 'POST', '/about');

    expect(result.status).toBe(405);
    expect(result.controller).toBeNull();
  });

  test.each(['POST', 'PUT', 'DELETE'])(
    'returns 405 for a %s request to an unknown path when a route does not accept it (audit pilot F12)',
    (method) => {
      const router = new Router();
      router.get('/about', 'about');

      expect(dispatch(router, method, '/missing').status).toBe(405);
    },
  );

  test('returns 404 for a POST request to an unknown path when every route accepts POST', () => {
    const router = new Router();
    router.post('/form', 'form');

    expect(dispatch(router, 'POST', '/missing').status).toBe(404);
  });

  test('returns 200 for a POST request that matches a POST route', () => {
    const router = new Router();
    router.get('/about', 'about');
    router.post('/form', 'form');

    const result = dispatch(router, 'POST', '/form');

    expect(result.status).toBe(200);
    expect(result.controller).toBe('form');
  });
});

describe('[STATUS_ERROR] route', () => {
  test('gives its controller to a 404 when it is the last GET route', () => {
    const router = new Router();
    router.get('/about', 'about');
    router.get('[STATUS_ERROR]', 'error');

    const result = dispatch(router, 'GET', '/missing');

    expect(result.status).toBe(404);
    expect(result.controller).toBe('error');
  });

  test('replaces a partially matched controller on a 404', () => {
    const router = new Router();
    router.get('/about', 'about');
    router.get('[STATUS_ERROR]', 'error');

    const result = dispatch(router, 'GET', '/about/extra');

    expect(result.status).toBe(404);
    expect(result.controller).toBe('error');
  });

  test('gives its controller to a 405', () => {
    const router = new Router();
    router.get('/about', 'about');
    router.get('[STATUS_ERROR]', 'error');

    const result = dispatch(router, 'POST', '/missing');

    expect(result.status).toBe(405);
    expect(result.controller).toBe('error');
  });

  test('is not used when a route matches', () => {
    const router = new Router();
    router.get('/about', 'about');
    router.get('[STATUS_ERROR]', 'error');

    const result = dispatch(router, 'GET', '/about');

    expect(result.status).toBe(200);
    expect(result.controller).toBe('about');
  });

  test('still works when another GET route is registered after it (audit pilot F1, fixed)', () => {
    const router = new Router();
    router.get('[STATUS_ERROR]', 'error');
    router.get('/about', 'about');

    const result = dispatch(router, 'GET', '/missing');

    expect(result.status).toBe(404);
    expect(result.controller).toBe('error');
  });

  test('is kept when only a POST route is registered after it (audit pilot F1)', () => {
    const router = new Router();
    router.get('[STATUS_ERROR]', 'error');
    router.post('/form', 'form');

    expect(dispatch(router, 'GET', '/missing').controller).toBe('error');
  });

  test('sets config to the error route config (audit pilot F2, fixed)', () => {
    const router = new Router();
    router.get('/about', 'about', { title: 'About' });
    router.get('[STATUS_ERROR]', 'error', { title: 'Error' });

    expect(dispatch(router, 'GET', '/missing').config).toEqual({ title: 'Error' });
  });

  test('sets config to an empty object when the error route has none', () => {
    const router = new Router();
    router.get('/about', 'about', { title: 'About' });
    router.get('[STATUS_ERROR]', 'error');

    expect(dispatch(router, 'GET', '/missing').config).toEqual({});
  });
});

// On `main` (1.3.0) the first route matching a prefix won; `develop` keeps looking
// for a route that matches the whole URI (see the audit, "Branches").
describe('route order (audit pilot F4)', () => {
  test('finds a longer route registered after a shorter route that matches its prefix', () => {
    const router = new Router();
    router.get('/shop', 'shop');
    router.get('/shop/{category:[^/]+}', 'category');

    expect(dispatch(router, 'GET', '/shop/sofas').controller).toBe('category');
    expect(dispatch(router, 'GET', '/shop').controller).toBe('shop');
  });

  test('lets a catch-all registered first win over a later literal route', () => {
    const router = new Router();
    router.get('/{page:.+}', 'catch-all');
    router.get('/about', 'about');

    const result = dispatch(router, 'GET', '/about');

    expect(result.status).toBe(200);
    expect(result.controller).toBe('catch-all');
  });

  test('uses the first of two routes that both match the whole URI', () => {
    const router = new Router();
    router.get('/{page:[a-z]+}', 'first');
    router.get('/about', 'second');

    expect(dispatch(router, 'GET', '/about').controller).toBe('first');
  });
});
