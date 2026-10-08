import { describe, expect, test } from 'vitest';
import { Router, Dispatcher } from '../src/index';

/**
 * Error controllers registered with router.notFound() and router.error() (D-050).
 */

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

describe('notFound', () => {
  test('gives its controller and config to a 404', () => {
    const router = new Router();
    router.get('/about', 'about');
    router.notFound('not-found', { title: 'Missing' });

    const result = dispatch(router, 'GET', '/missing');

    expect([result.status, result.controller, result.config]).toEqual([404, 'not-found', { title: 'Missing' }]);
  });

  test('sets config to an empty object when none is given', () => {
    const router = new Router();
    router.notFound('not-found');

    expect(dispatch(router, 'GET', '/missing').config).toEqual({});
  });

  test.each(['POST', 'PUT', 'DELETE'])('answers a 404 for a %s request too', (method) => {
    const router = new Router();
    router.notFound('not-found');

    expect(dispatch(router, method, '/missing').controller).toBe('not-found');
  });

  test('is not used for a 405', () => {
    const router = new Router();
    router.get('/about', 'about');
    router.notFound('not-found');

    const result = dispatch(router, 'POST', '/about');

    expect([result.status, result.controller, result.config]).toEqual([405, null, null]);
  });

  test('is not used when a route matches', () => {
    const router = new Router();
    router.notFound('not-found');
    router.get('/about', 'about');

    expect(dispatch(router, 'GET', '/about').controller).toBe('about');
  });

  test('is the same as error(404)', () => {
    const router = new Router();
    router.error(404, 'first');
    router.notFound('second');

    expect(dispatch(router, 'GET', '/missing').controller).toBe('second');
  });
});

describe('error', () => {
  test('gives a 405 its own controller', () => {
    const router = new Router();
    router.post('/form', 'form');
    router.error(405, 'not-allowed', { title: 'Not allowed' });

    const result = dispatch(router, 'GET', '/form');

    expect([result.status, result.controller, result.config]).toEqual([405, 'not-allowed', { title: 'Not allowed' }]);
  });

  test('keeps each status apart', () => {
    const router = new Router();
    router.get('/about', 'about');
    router.notFound('not-found');
    router.error(405, 'not-allowed');

    expect(dispatch(router, 'GET', '/missing').controller).toBe('not-found');
    expect(dispatch(router, 'POST', '/about').controller).toBe('not-allowed');
  });

  test('replaces the controller when a status is registered again', () => {
    const router = new Router();
    router.error(405, 'first');
    router.error(405, 'second');
    router.get('/about', 'about');

    expect(dispatch(router, 'POST', '/about').controller).toBe('second');
  });

  test('keeps path, vars and params empty', () => {
    const router = new Router();
    router.get('/about', 'about');
    router.notFound('not-found');

    const result = dispatch(router, 'GET', '/about/extra');

    expect([result.path, result.vars, result.params]).toEqual([[], {}, {}]);
  });

  test.each([200, 400, 500, '404', null, undefined])('throws for status %j', (status) => {
    expect(() => new Router().error(status, 'error'))
      .toThrow(`Argument 1 (status) needs to be 404 or 405, got ${JSON.stringify(status)}.`);
  });
});

describe('with [STATUS_ERROR] (kept as an alias, D-050)', () => {
  test('the status controller wins, whichever was registered first', () => {
    const first = new Router();
    first.notFound('not-found');
    first.get('[STATUS_ERROR]', 'error');
    const second = new Router();
    second.get('[STATUS_ERROR]', 'error');
    second.notFound('not-found');

    expect(dispatch(first, 'GET', '/missing').controller).toBe('not-found');
    expect(dispatch(second, 'GET', '/missing').controller).toBe('not-found');
  });

  test('[STATUS_ERROR] answers a status that has no controller of its own', () => {
    const router = new Router();
    router.get('/about', 'about');
    router.notFound('not-found');
    router.get('[STATUS_ERROR]', 'error', { title: 'Error' });

    const result = dispatch(router, 'POST', '/about');

    expect([result.status, result.controller, result.config]).toEqual([405, 'error', { title: 'Error' }]);
  });
});

describe('the router API around error controllers', () => {
  test('getStatusErrorRoute returns the chosen controller with its status and config', () => {
    const router = new Router();
    router.get('[STATUS_ERROR]', 'error');
    router.notFound('not-found', { title: 'Missing' });

    expect(router.getStatusErrorRoute(404)).toEqual({ status: 404, controller: 'not-found', config: { title: 'Missing' } });
    expect(router.getStatusErrorRoute(405)).toEqual({
      verb: ['GET'], pattern: '[STATUS_ERROR]', controller: 'error', config: {},
    });
  });

  test('getStatusError returns the chosen controller', () => {
    const router = new Router();
    router.error(405, 'not-allowed');

    expect([router.getStatusError(404), router.getStatusError(405)]).toEqual([false, 'not-allowed']);
  });

  test('error controllers are not routes: getRouters and hasPostRoutes leave them out', () => {
    const router = new Router();
    router.notFound('not-found');
    router.error(405, 'not-allowed');

    expect(router.getRouters()).toEqual([]);
    expect(router.hasPostRoutes()).toBe(false);
  });
});

describe('dispatcher()', () => {
  test('passes the notFound controller and status 404 to the callback', () => {
    const router = new Router();
    router.get('/', 'start');
    router.notFound('not-found');
    const dispatcher = new Dispatcher();
    const responses = [];
    dispatcher.dispatcher(router, dispatcher.request('path'), (response, status) => {
      responses.push([response.controller, status]);
    });

    dispatcher.navigateTo('/missing');

    expect(responses).toEqual([['start', 200], ['not-found', 404]]);
  });
});
