import { describe, expect, test } from 'vitest';
import { Router, Dispatcher } from '../src/index';

/**
 * The routes used by every test. Each route has its own controller value,
 * so a test can tell which route matched.
 * @return {Router}
 */
function createRouter() {
  const router = new Router();
  router.get('/', 'start');
  router.get('/{type:a}/{page:test}/{id:[0-9]+}', 'a-number');
  router.get('/{type:a}/{page:test}/{id:[a-z]+}', 'a-letters');
  router.get('/{type:b}/{page:.+}', 'b-any');
  router.get('/{type:c}/{page:[^/]+}/test2', 'c-segment');
  router.post('/{type:d}/{page:contact}', 'd-contact');
  return router;
}

/**
 * Start a dispatcher and collect every response passed to its callback.
 * Without a browser, navigation dispatches synchronously, so the responses
 * are collected by the time a navigation call returns.
 * @return {{ dispatcher: Dispatcher, responses: Array<{ data: object, status: number }> }}
 */
function startDispatcher() {
  const router = createRouter();
  const dispatcher = new Dispatcher();
  const responses = [];
  dispatcher.dispatcher(router, dispatcher.request('path'), (data, status) => {
    responses.push({ data, status });
  });
  return { dispatcher, responses };
}

describe('validateDispatch', () => {
  test.each([
    { method: 'GET', uri: '/', controller: 'start', path: [], vars: {} },
    {
      method: 'GET',
      uri: '/a/test/12',
      controller: 'a-number',
      path: ['a', 'test', '12'],
      vars: { type: ['a'], page: ['test'], id: ['12'] },
    },
    {
      method: 'GET',
      uri: '/a/test/ab',
      controller: 'a-letters',
      path: ['a', 'test', 'ab'],
      vars: { type: ['a'], page: ['test'], id: ['ab'] },
    },
    {
      method: 'GET',
      uri: '/b/test/test2/test3',
      controller: 'b-any',
      path: ['b', 'test', 'test2', 'test3'],
      vars: { type: ['b'], page: ['test', 'test2', 'test3'] },
    },
    {
      method: 'GET',
      uri: '/c/test/test2',
      controller: 'c-segment',
      path: ['c', 'test', 'test2'],
      // The literal segment is stored under its position (audit pilot F8)
      vars: { type: ['c'], page: ['test'], 2: ['test2'] },
    },
    {
      method: 'POST',
      uri: '/d/contact',
      controller: 'd-contact',
      path: ['d', 'contact'],
      vars: { type: ['d'], page: ['contact'] },
    },
  ])('$method $uri matches route $controller', ({ method, uri, controller, path, vars }) => {
    const result = new Dispatcher().validateDispatch(createRouter(), method, uri);

    expect(result.status).toBe(200);
    expect(result.verb).toBe(method);
    expect(result.controller).toBe(controller);
    expect(result.path).toEqual(path);
    expect(result.vars).toEqual(vars);
  });
});

describe('dispatcher', () => {
  test('calls the callback for the start page and once per navigation', () => {
    const { dispatcher, responses } = startDispatcher();
    dispatcher.navigateTo('/a/test/12');
    dispatcher.navigateTo('/a/test/ab');
    dispatcher.navigateTo('/b/test/test2/test3');
    dispatcher.navigateTo('/c/test/test2');
    dispatcher.postTo('/d/contact');

    const controllers = responses.map(({ data }) => data.controller);
    expect(controllers).toEqual(['start', 'a-number', 'a-letters', 'b-any', 'c-segment', 'd-contact']);
  });

  test('passes status 200 in the response and as the second argument', () => {
    const { dispatcher, responses } = startDispatcher();
    dispatcher.navigateTo('/a/test/12');
    dispatcher.postTo('/d/contact');

    expect(responses).toHaveLength(3);
    responses.forEach(({ data, status }) => {
      expect(data.status).toBe(200);
      expect(status).toBe(200);
    });
  });

  test('gives every response a string verb, a numeric status and object path, vars and request', () => {
    const { dispatcher, responses } = startDispatcher();
    dispatcher.navigateTo('/a/test/12');
    dispatcher.postTo('/d/contact');

    expect(responses).toHaveLength(3);
    responses.forEach(({ data }) => {
      expect(typeof data.verb).toBe('string');
      expect(typeof data.status).toBe('number');
      expect(typeof data.path).toBe('object');
      expect(typeof data.vars).toBe('object');
      expect(typeof data.request).toBe('object');
    });
  });

  test('passes navigateTo params to GET routes as URLSearchParams', () => {
    const { dispatcher, responses } = startDispatcher();
    dispatcher.navigateTo('/a/test/12', { param: 10 });
    dispatcher.navigateTo('/a/test/ab', { param: 10 });
    dispatcher.navigateTo('/b/test/test2/test3', { param: 10 });
    dispatcher.navigateTo('/c/test/test2', { param: 10 });

    const navigations = responses.slice(1);
    expect(navigations).toHaveLength(4);
    navigations.forEach(({ data }) => {
      expect(data.verb).toBe('GET');
      expect(data.request.get).toBeInstanceOf(URLSearchParams);
      expect(data.request.get.get('param')).toBe('10');
    });
  });

  test('passes postTo params to POST routes as the post object', () => {
    const { dispatcher, responses } = startDispatcher();
    dispatcher.postTo('/d/contact', { param: 10 });

    const { data } = responses.at(-1);
    expect(data.verb).toBe('POST');
    expect(data.request.post).toEqual({ param: 10 });
  });
});
