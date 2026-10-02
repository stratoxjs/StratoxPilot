import { describe, expect, test } from 'vitest';
import { Router, Dispatcher } from '../src/index';

/**
 * Start a dispatcher in Node (no window) and collect every response.
 * Navigation dispatches synchronously, so responses are collected by the
 * time a navigation call returns.
 * @param  {object} configs Dispatcher configs
 * @return {{ dispatcher: Dispatcher, responses: object[] }}
 */
function startDispatcher(configs = {}) {
  const router = new Router();
  router.get('/', 'start');
  router.get('/about', 'about');
  router.post('/form', 'post-form');
  router.put('/form', 'put-form');
  router.delete('/item', 'delete-item');
  const dispatcher = new Dispatcher(configs);
  const responses = [];
  dispatcher.dispatcher(router, dispatcher.request('path'), (data) => {
    responses.push(data);
  });
  return { dispatcher, responses };
}

describe('navigation methods', () => {
  test('navigateTo throws when called before dispatcher()', () => {
    expect(() => new Dispatcher().navigateTo('/about'))
      .toThrow('Trying to emit to an event (popstate) that does not yet exist.');
  });

  test('navigateTo returns the request object it was given', () => {
    const { dispatcher } = startDispatcher();
    const request = { page: 2 };

    expect(dispatcher.navigateTo('/about', request)).toBe(request);
  });

  test('pushToState works like navigateTo', () => {
    const { dispatcher, responses } = startDispatcher();
    const result = dispatcher.pushToState('/about', { page: 2 });

    const { verb, controller, request } = responses.at(-1);
    expect(result).toEqual({ page: 2 });
    expect(verb).toBe('GET');
    expect(controller).toBe('about');
    expect(request.get.get('page')).toBe('2');
  });

  test.each([
    { method: 'postTo', verb: 'POST', controller: 'post-form' },
    { method: 'putTo', verb: 'PUT', controller: 'put-form' },
  ])('$method sends its data as the post object and returns it (audit pilot F9, fixed)', ({ method, verb, controller }) => {
    const { dispatcher, responses } = startDispatcher();
    const data = { name: 'Ada' };
    const result = dispatcher[method]('/form', data);

    const response = responses.at(-1);
    expect(result).toBe(data);
    expect(response.verb).toBe(verb);
    expect(response.controller).toBe(controller);
    expect(response.request.post).toEqual({ name: 'Ada' });
  });

  test('deleteTo sends its data as the GET query, unlike postTo and putTo (audit pilot F9)', () => {
    const { dispatcher, responses } = startDispatcher();
    const result = dispatcher.deleteTo('/item', { id: 7 });

    const response = responses.at(-1);
    expect(result).toEqual({ id: 7 });
    expect(response.verb).toBe('DELETE');
    expect(response.controller).toBe('delete-item');
    expect(response.request.get.get('id')).toBe('7');
    expect(response.request.post).toEqual({});
  });

  test('mapTo sends GET and POST data and returns the GET data', () => {
    const { dispatcher, responses } = startDispatcher();
    const result = dispatcher.mapTo('POST', '/form', { page: 1 }, { name: 'Ada' });

    const { request } = responses.at(-1);
    expect(result).toEqual({ page: 1 });
    expect(request.get.get('page')).toBe('1');
    expect(request.post).toEqual({ name: 'Ada' });
  });

  test('a query string in the navigateTo path moves into request.get (audit pilot F26, fixed)', () => {
    const { dispatcher, responses } = startDispatcher();
    dispatcher.navigateTo('/about?page=2');

    const { status, controller, request } = responses.at(-1);
    expect(status).toBe(200);
    expect(controller).toBe('about');
    expect(request.get.get('page')).toBe('2');
  });

  test('pushState throws for a verb that is not supported', () => {
    const { dispatcher } = startDispatcher();

    expect(() => dispatcher.pushState('/about', { method: 'patch' }))
      .toThrow('The verb (http method) "PATCH" is not allowed.');
  });

  test('pushState dispatches state.request.path when the state has one', () => {
    const { dispatcher, responses } = startDispatcher();
    dispatcher.pushState('/about', { method: 'GET', request: { path: '/' } });

    expect(responses.at(-1).controller).toBe('start');
  });

  test.each([
    { label: 'no request', state: { method: 'GET' } },
    { label: 'a request without a path', state: { method: 'GET', request: { get: {} } } },
  ])('pushState dispatches its path argument when the state has $label (audit pilot F25, fixed)', ({ state }) => {
    const { dispatcher, responses } = startDispatcher();
    dispatcher.pushState('/about', state);

    expect(responses.at(-1).controller).toBe('about');
  });

  test('pushState without a request path leaves the caller\'s request object unchanged', () => {
    const { dispatcher } = startDispatcher();
    const request = { get: {} };
    dispatcher.pushState('/about', { method: 'GET', request });

    expect(request).toEqual({ get: {} });
  });
});

describe('response object', () => {
  test('has form null when no form was caught', () => {
    const { responses } = startDispatcher();

    expect(responses[0].form).toBeNull();
  });

  test('has the matched route config', () => {
    const router = new Router();
    router.get('/', 'start', { title: 'Start' });
    const dispatcher = new Dispatcher();
    const responses = [];
    dispatcher.dispatcher(router, dispatcher.request('path'), (data) => responses.push(data));

    expect(responses[0].config).toEqual({ title: 'Start' });
  });
});

describe('request and serverParams', () => {
  test('request() returns the current request without a path before any navigation', () => {
    const { dispatcher } = startDispatcher();

    const request = dispatcher.request();
    expect(Object.keys(request)).toEqual(['get', 'post']);
    expect(request.get).toBeInstanceOf(URLSearchParams);
    expect(request.get.toString()).toBe('');
    expect(request.post).toEqual({});
  });

  test('request(key) returns a function that falls back to "/" when the key is missing', () => {
    const { dispatcher } = startDispatcher();

    expect(String(dispatcher.request('path')())).toBe('/');
  });

  test('request(key)() returns a String object, not a string (audit pilot F10)', () => {
    const { dispatcher } = startDispatcher();
    dispatcher.navigateTo('/about');

    const path = dispatcher.request('path')();
    expect(typeof path).toBe('object');
    expect(path).toBeInstanceOf(String);
    expect(String(path)).toBe('/about');
  });

  test('serverParams() without a window has empty location values', () => {
    expect(new Dispatcher().serverParams()).toEqual({
      host: '',
      hash: '',
      fragment: '/',
      path: '/',
      auto: '/',
      query: {},
    });
  });

  test('serverParams() merges the server config over the location values', () => {
    const dispatcher = new Dispatcher({ server: { path: '/custom', extra: 1 } });

    expect(dispatcher.serverParams()).toMatchObject({ path: '/custom', extra: 1, fragment: '/' });
  });

  test('serverParams(key)() returns a String object, not a string (audit pilot F10)', () => {
    const path = new Dispatcher().serverParams('path')();

    expect(path).toBeInstanceOf(String);
    expect(String(path)).toBe('/');
  });
});

describe('path helpers', () => {
  test('buildGetPath returns the path unchanged without a request', () => {
    expect(new Dispatcher().buildGetPath('/about')).toEqual({ path: '/about', pathname: '/about' });
  });

  test('buildGetPath appends the request as a query string', () => {
    const request = { a: 1, b: 'x y' };

    expect(new Dispatcher().buildGetPath('/about', request))
      .toEqual({ path: '/about?a=1&b=x+y', query: request, pathname: '/about' });
  });

  // The docs show this result for navigateTo('#articles/...', { test: ... }) (audit pilot F17).
  test('buildGetPath moves a query string in the path into the query; the request wins on the same key', () => {
    expect(new Dispatcher().buildGetPath('/about?a=1&b=1', { b: 2 })).toEqual({
      path: '/about?a=1&b=2',
      query: { a: '1', b: 2 },
      pathname: '/about',
    });
  });

  test('buildGetPath puts the query before a hash and resets the path to "/" (audit pilot F17)', () => {
    expect(new Dispatcher().buildGetPath('#about', { a: 1 }).path).toBe('/?a=1#about');
  });

  test.each([
    { path: '#about', request: undefined, result: '#!about' },
    { path: '#!about', request: undefined, result: '#!about' },
    { path: '#about', request: { a: 1 }, result: '/?a=1#!about' },
    { path: '/about', request: undefined, result: '/about' },
  ])('buildGetPath($path) with fragmentPrefix "!" gives $result (audit pilot F27, fixed)', ({ path, request, result }) => {
    expect(new Dispatcher({ fragmentPrefix: '!' }).buildGetPath(path, request).path).toBe(result);
  });

  test('buildGetPath uses the hash of a URL as the pathname', () => {
    const result = new Dispatcher().buildGetPath(new URL('http://example.test/shop?q=1#cart'), { a: 1 });

    expect(result.path).toBe('/shop?a=1#cart');
    expect(result.pathname).toBe('/cart');
  });

  test('buildGetPath uses the path of a URL without a hash as the pathname', () => {
    const result = new Dispatcher().buildGetPath(new URL('http://example.test/shop?q=1'), { a: 1 });

    expect(result.path).toBe('/shop?a=1');
    expect(result.pathname).toBe('/shop');
  });

  test('buildQueryObj returns URLSearchParams', () => {
    const query = new Dispatcher().buildQueryObj({ a: 1 });

    expect(query).toBeInstanceOf(URLSearchParams);
    expect(query.toString()).toBe('a=1');
  });

  test('baseDir returns the path unchanged when there is no root', () => {
    expect(new Dispatcher().baseDir('page')).toBe('page');
  });

  test.each([
    { path: '/app/page', add: false, result: '/page' },
    { path: '/app/page', add: true, result: '/app/page' },
    { path: 'page', add: false, result: '/page' },
  ])('baseDir($path, $add) with root /app is $result', ({ path, add, result }) => {
    expect(new Dispatcher({ root: '/app' }).baseDir(path, add)).toBe(result);
  });

  test.each([
    { root: '/app', path: '/shop/app/page' },
    { root: 'app', path: '/myapp/page' },
    { root: '/app', path: '/apple' },
  ])('baseDir leaves $path unchanged with root $root (audit pilot F18, fixed)', ({ root, path }) => {
    expect(new Dispatcher({ root }).baseDir(path)).toBe(path);
  });

  test.each([
    { root: '/app', path: '/app', result: '/' },
    { root: '/app/', path: '/app/page', result: '/page' },
  ])('baseDir($path) with root $root is $result', ({ root, path, result }) => {
    expect(new Dispatcher({ root }).baseDir(path)).toBe(result);
  });

  test.each([
    { path: 'a', result: '/a' },
    { path: '/a', result: '/a' },
    { path: '', result: '/' },
  ])('addLeadingSlash("$path") is "$result"', ({ path, result }) => {
    expect(new Dispatcher().addLeadingSlash(path)).toBe(result);
  });

  test.each([
    { query: 'a=1', result: '?a=1' },
    { query: '', result: '' },
    { query: 5, result: '' },
  ])('getQueryStr($query) is "$result"', ({ query, result }) => {
    expect(new Dispatcher().getQueryStr(query)).toBe(result);
  });
});

describe('other helpers', () => {
  test('htmlspecialchars escapes & < > " \' and leaves | alone (audit pilot F6, | fixed)', () => {
    expect(new Dispatcher().htmlspecialchars('<a href="x">\'&|</a>'))
      .toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;|&lt;/a&gt;');
  });

  test('htmlspecialchars_decode reverses one level of escaping', () => {
    expect(new Dispatcher().htmlspecialchars_decode('&lt;b&gt; &amp; &quot;q&quot; &#39;s&#39; &amp;lt;'))
      .toBe('<b> & "q" \'s\' &lt;');
  });

  test('objToFormData copies an object into FormData', () => {
    const formData = new Dispatcher().objToFormData({ a: 1, b: 'x' });

    expect(formData).toBeInstanceOf(FormData);
    expect([...formData.entries()]).toEqual([['a', '1'], ['b', 'x']]);
  });

  test('getRouterData returns the routes of a Router', () => {
    const router = new Router();
    router.get('/a', 'a');

    expect(new Dispatcher().getRouterData(router)).toBe(router.getRouters());
  });

  test('getRouterData accepts a plain array of routes', () => {
    const routes = [{ verb: ['GET'], pattern: '/a', controller: 'a' }];

    expect(new Dispatcher().getRouterData(routes)).toBe(routes);
  });

  test('getRouterData throws for anything else', () => {
    expect(() => new Dispatcher().getRouterData('routes')).toThrow('(routeCollection) is expected');
  });

  test('getStateHandler returns the same StateHandler every time', () => {
    const dispatcher = new Dispatcher();

    expect(dispatcher.getStateHandler()).toBe(dispatcher.getStateHandler());
    expect(dispatcher.getStateHandler().constructor.name).toBe('StateHandler');
  });

  test('initStateHandler creates a StateHandler whose state has method GET and the server params', () => {
    const handler = new Dispatcher().initStateHandler({ extra: 1 });

    expect(handler.getState().method).toBe('GET');
    expect(handler.getState().server.extra).toBe(1);
  });
});
