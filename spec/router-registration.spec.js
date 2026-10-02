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

  test('map upper-cases the array passed to it in place (audit pilot F11)', () => {
    const router = new Router();
    const verbs = ['get', 'post'];
    router.map(verbs, '/page', 'page');

    expect(verbs).toEqual(['GET', 'POST']);
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

// The check compares only with the most recent route for the same verb
// (or the same array of verbs), and only when its controller is a string.
describe('duplicate pattern check (audit pilot F1)', () => {
  test('throws when the same verb and pattern are registered twice in a row', () => {
    const router = new Router();
    router.get('/page', 'first');

    expect(() => router.get('/page', 'second')).toThrow('Argument 2 (pattern: /page) already exists.');
  });

  test('does not throw when another route for the same verb was registered in between', () => {
    const router = new Router();
    router.get('/page', 'first');
    router.get('/other', 'other');
    router.get('/page', 'second');

    expect(router.getRouters()).toHaveLength(3);
  });

  test('does not throw when the controllers are functions', () => {
    const router = new Router();
    router.get('/page', () => 'first');
    router.get('/page', () => 'second');

    expect(router.getRouters()).toHaveLength(2);
  });

  test('does not throw for the same pattern with another verb', () => {
    const router = new Router();
    router.get('/page', 'read');
    router.post('/page', 'write');

    expect(router.getRouters()).toHaveLength(2);
  });

  test('throws for the same array of verbs registered twice in a row', () => {
    const router = new Router();
    router.map(['GET', 'POST'], '/page', 'first');

    expect(() => router.map(['GET', 'POST'], '/page', 'second')).toThrow('already exists');
  });

  test('does not compare a single verb with an earlier array of verbs', () => {
    const router = new Router();
    router.map(['GET', 'POST'], '/page', 'first');
    router.get('/page', 'second');

    expect(router.getRouters()).toHaveLength(2);
  });
});

describe('getStatusError', () => {
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

describe('hasPostRoutes', () => {
  test('returns false when there is no POST route', () => {
    const router = new Router();
    router.get('/page', 'page');

    expect(router.hasPostRoutes()).toBe(false);
  });

  test('returns only the last POST route as { pattern: controller } (audit pilot F1)', () => {
    const router = new Router();
    router.post('/first', 'first');
    router.post('/second', 'second');

    expect(router.hasPostRoutes()).toEqual({ '/second': 'second' });
  });

  test('returns false when POST is only registered in an array of verbs (audit pilot F1)', () => {
    const router = new Router();
    router.map(['GET', 'POST'], '/page', 'page');

    expect(router.hasPostRoutes()).toBe(false);
  });
});

describe('verb helpers', () => {
  test('getValidVerbs lists GET, POST, PUT and DELETE', () => {
    expect(Router.getValidVerbs()).toEqual(['GET', 'POST', 'PUT', 'DELETE']);
  });

  test('getValidVerbs returns the internal array, not a copy (audit pilot F24)', () => {
    expect(Router.getValidVerbs()).toBe(Router.getValidVerbs());
  });

  test.each([
    { verb: 'GET', valid: true },
    { verb: 'DELETE', valid: true },
    { verb: 'get', valid: false },
    { verb: 'PATCH', valid: false },
  ])('isValidVerb($verb) is $valid', ({ verb, valid }) => {
    expect(Router.isValidVerb(verb)).toBe(valid);
  });

  test('validateVerb upper-cases the array in place and returns it (audit pilot F11)', () => {
    const verbs = ['get', 'Post'];

    expect(Router.validateVerb(verbs)).toBe(verbs);
    expect(verbs).toEqual(['GET', 'POST']);
  });

  test('validateVerb names the upper-cased verb when it is not supported', () => {
    expect(() => Router.validateVerb(['GET', 'head'])).toThrow('The verb (http method) "HEAD" is not allowed');
  });

  test('validateVerb throws a TypeError for a string, because it expects an array', () => {
    expect(() => Router.validateVerb('get')).toThrow(TypeError);
  });
});
