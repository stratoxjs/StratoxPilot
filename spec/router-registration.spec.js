import { describe, expect, test } from 'vitest';
import { Router } from '../src/index';

describe('registering routes', () => {
  test.each([
    { method: 'get', verb: 'GET' },
    { method: 'post', verb: 'POST' },
    { method: 'put', verb: 'PUT' },
    { method: 'delete', verb: 'DELETE' },
  ])('$method() stores a route with verb $verb and an empty config', ({ method, verb }) => {
    const router = new Router();
    router[method]('/page', 'page');

    expect(router.getRouters()).toEqual([
      { verb: [verb], pattern: '/page', controller: 'page', config: {} },
    ]);
  });

  test('stores the config argument', () => {
    const router = new Router();
    router.get('/page', 'page', { title: 'Page' });

    expect(router.getRouters()[0].config).toEqual({ title: 'Page' });
  });

  test('keeps the routes in the order they were registered', () => {
    const router = new Router();
    router.get('/first', 'first');
    router.post('/second', 'second');

    expect(router.getRouters().map((route) => route.pattern)).toEqual(['/first', '/second']);
  });

  test('getRouters returns the same array on every call', () => {
    const router = new Router();

    expect(router.getRouters()).toBe(router.getRouters());
  });

  test('map accepts a lower-case verb and stores it upper-case', () => {
    const router = new Router();
    router.map('get', '/page', 'page');

    expect(router.getRouters()[0].verb).toEqual(['GET']);
  });

  test('map accepts an array of verbs', () => {
    const router = new Router();
    router.map(['GET', 'POST'], '/page', 'page');

    expect(router.getRouters()[0].verb).toEqual(['GET', 'POST']);
  });

  test('map leaves the array passed to it unchanged (audit pilot F11, fixed)', () => {
    const router = new Router();
    const verbs = ['get', 'post'];
    router.map(verbs, '/page', 'page');

    expect(verbs).toEqual(['get', 'post']);
    expect(router.getRouters()[0].verb).toEqual(['GET', 'POST']);
  });
});

describe('invalid arguments', () => {
  test('throws for a verb that is not supported', () => {
    expect(() => new Router().map('PATCH', '/page', 'page'))
      .toThrow('The verb (http method) "PATCH" is not allowed. Supported verbs: GET, POST, PUT, DELETE');
  });

  test('throws when the verb is neither a string nor an array', () => {
    expect(() => new Router().map(5, '/page', 'page')).toThrow('Argument 1 (verb) needs to be string or array.');
  });

  test('throws when the pattern is not a string', () => {
    expect(() => new Router().get(5, 'page')).toThrow('Argument 2 (pattern) needs to be a string.');
  });
});

// A pattern can be registered once per method (audit pilot F1, fixed, D-051)
describe('duplicate pattern check (audit pilot F1, fixed, D-051)', () => {
  test('throws when the same verb and pattern are registered twice in a row', () => {
    const router = new Router();
    router.get('/page', 'first');

    expect(() => router.get('/page', 'second')).toThrow('Argument 2 (pattern: /page) already exists for GET.');
  });

  test('throws when another route for the same verb was registered in between', () => {
    const router = new Router();
    router.get('/page', 'first');
    router.get('/other', 'other');

    expect(() => router.get('/page', 'second')).toThrow('Argument 2 (pattern: /page) already exists for GET.');
  });

  test('throws when the controllers are functions', () => {
    const router = new Router();
    router.get('/page', () => 'first');

    expect(() => router.get('/page', () => 'second')).toThrow('already exists for GET.');
  });

  test('throws for a lower-case verb registered twice, because verbs are compared upper-cased', () => {
    const router = new Router();
    router.map('get', '/page', 'first');

    expect(() => router.map('get', '/page', 'second')).toThrow('already exists for GET.');
    expect(() => router.get('/page', 'third')).toThrow('already exists for GET.');
  });

  test.each([
    { first: ['GET', 'POST'], second: ['GET', 'POST'], taken: 'GET, POST' },
    { first: ['GET', 'POST'], second: ['GET'], taken: 'GET' },
    { first: ['POST'], second: ['GET', 'POST'], taken: 'POST' },
  ])('throws when $second shares a verb with an earlier $first route', ({ first, second, taken }) => {
    const router = new Router();
    router.map(first, '/page', 'first');

    expect(() => router.map(second, '/page', 'second')).toThrow(`already exists for ${taken}.`);
  });

  test('leaves the routes as they were when it throws', () => {
    const router = new Router();
    router.get('/page', 'first');

    expect(() => router.get('/page', 'second')).toThrow();
    expect(router.getRouters().map((route) => route.controller)).toEqual(['first']);
  });

  test('does not throw for the same pattern with another verb', () => {
    const router = new Router();
    router.get('/page', 'read');
    router.post('/page', 'write');
    router.map(['PUT', 'DELETE'], '/page', 'change');

    expect(router.getRouters()).toHaveLength(3);
  });

  test('compares patterns as written, so two patterns for the same paths are both kept', () => {
    const router = new Router();
    router.get('/{id:[0-9]+}', 'first');
    router.get('/{number:[0-9]+}', 'second');

    expect(router.getRouters()).toHaveLength(2);
  });

  test('leaves out [STATUS_ERROR]: it may be registered again, and the last one wins', () => {
    const router = new Router();
    router.get('[STATUS_ERROR]', 'first-error');
    router.get('[STATUS_ERROR]', 'second-error');

    expect(router.getStatusError(404)).toBe('second-error');
  });
});

describe('getStatusError', () => {
  test.each([null, undefined])('returns false when the error route has the controller %j', (controller) => {
    const router = new Router();
    router.get('[STATUS_ERROR]', controller);

    expect(router.getStatusError(404)).toBe(false);
  });

  test('finds the error route wherever it was registered (audit pilot F1, fixed)', () => {
    const router = new Router();
    router.get('[STATUS_ERROR]', 'error');
    router.get('/page', 'page');
    router.post('/form', 'form');

    expect(router.getStatusError(404)).toBe('error');
  });

  test('uses the last error route when there are several', () => {
    const router = new Router();
    router.get('[STATUS_ERROR]', 'first-error');
    router.get('/page', 'page');
    router.get('[STATUS_ERROR]', 'second-error');

    expect(router.getStatusError(404)).toBe('second-error');
  });

  test('returns false when there is no [STATUS_ERROR] route', () => {
    const router = new Router();
    router.get('/page', 'page');

    expect(router.getStatusError(404)).toBe(false);
  });

  test('returns false for status 200', () => {
    const router = new Router();
    router.get('[STATUS_ERROR]', 'error');

    expect(router.getStatusError(200)).toBe(false);
  });

  test.each([404, 405, 500])('returns the error controller for status %i', (status) => {
    const router = new Router();
    router.get('[STATUS_ERROR]', 'error');

    expect(router.getStatusError(status)).toBe('error');
  });
});

describe('getStatusErrorRoute', () => {
  test('returns the whole [STATUS_ERROR] route for an error status', () => {
    const router = new Router();
    router.get('[STATUS_ERROR]', 'error', { title: 'Error' });

    expect(router.getStatusErrorRoute(404)).toEqual({
      verb: ['GET'], pattern: '[STATUS_ERROR]', controller: 'error', config: { title: 'Error' },
    });
  });

  test('returns false for status 200 and when there is no error route', () => {
    const router = new Router();
    router.get('[STATUS_ERROR]', 'error');

    expect(router.getStatusErrorRoute(200)).toBe(false);
    expect(new Router().getStatusErrorRoute(404)).toBe(false);
  });
});

describe('hasPostRoutes', () => {
  test('returns false when there is no POST route', () => {
    const router = new Router();
    router.get('/page', 'page');

    expect(router.hasPostRoutes()).toBe(false);
  });

  test('returns every POST route as { pattern: controller } (audit pilot F1, fixed)', () => {
    const router = new Router();
    router.post('/first', 'first');
    router.get('/other', 'other');
    router.post('/second', 'second');

    expect(router.hasPostRoutes()).toEqual({ '/first': 'first', '/second': 'second' });
  });

  test('includes a route that has POST in an array of verbs (audit pilot F1, fixed)', () => {
    const router = new Router();
    router.map(['GET', 'POST'], '/page', 'page');

    expect(router.hasPostRoutes()).toEqual({ '/page': 'page' });
  });
});

describe('verb helpers', () => {
  test('getValidVerbs lists GET, POST, PUT and DELETE', () => {
    expect(Router.getValidVerbs()).toEqual(['GET', 'POST', 'PUT', 'DELETE']);
  });

  test('getValidVerbs returns a copy, so changing it does not change the valid verbs (audit pilot F24, fixed)', () => {
    const verbs = Router.getValidVerbs();
    verbs.push('PATCH');
    const patchAccepted = Router.isValidVerb('PATCH');
    verbs.pop(); // if the list were shared again, this keeps PATCH out of the other tests

    expect(Router.getValidVerbs()).not.toBe(verbs);
    expect(patchAccepted).toBe(false);
  });

  test.each([
    { verb: 'GET', valid: true },
    { verb: 'DELETE', valid: true },
    { verb: 'get', valid: false },
    { verb: 'PATCH', valid: false },
  ])('isValidVerb($verb) is $valid', ({ verb, valid }) => {
    expect(Router.isValidVerb(verb)).toBe(valid);
  });

  test('validateVerb returns an upper-cased copy and leaves its argument unchanged (audit pilot F11, fixed)', () => {
    const verbs = ['get', 'Post'];

    expect(Router.validateVerb(verbs)).toEqual(['GET', 'POST']);
    expect(verbs).toEqual(['get', 'Post']);
  });

  test('validateVerb names the upper-cased verb when it is not supported', () => {
    expect(() => Router.validateVerb(['GET', 'head'])).toThrow('The verb (http method) "HEAD" is not allowed');
  });

  test('validateVerb throws a TypeError for a string, because it expects an array', () => {
    expect(() => Router.validateVerb('get')).toThrow(TypeError);
  });
});
