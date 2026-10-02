// @vitest-environment happy-dom
import { beforeEach, describe, expect, test } from 'vitest';
import { Router, Dispatcher } from '../src/index';

/**
 * Start a dispatcher on the given server param and collect "status:controller"
 * for every dispatch.
 * @param  {object} configs     Dispatcher configs
 * @param  {string} serverParam Name passed to serverParams(), e.g. "fragment"
 * @return {{ dispatcher: Dispatcher, seen: string[] }}
 */
function startDispatcher(configs, serverParam) {
  const router = new Router();
  router.get('/', 'start');
  router.get('/about', 'about');
  const dispatcher = new Dispatcher(configs);
  const seen = [];
  dispatcher.dispatcher(router, dispatcher.serverParams(serverParam), (data, status) => {
    seen.push(`${status}:${data.controller}`);
  });
  return { dispatcher, seen };
}

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  document.body.innerHTML = '';
});

describe('serverParams in a browser', () => {
  test('reads host, path, hash, fragment and query from window.location', () => {
    window.history.replaceState({}, '', '/shop?page=2#cart');

    expect(new Dispatcher().serverParams()).toEqual({
      host: window.location.href,
      hash: '#cart',
      fragment: '/cart',
      path: '/shop',
      auto: '/shop',
      query: { page: '2' },
    });
  });

  test('auto uses the fragment when the path is "/"', () => {
    window.history.replaceState({}, '', '/#about');

    expect(new Dispatcher().serverParams().auto).toBe('/about');
  });
});

describe('fragmentPrefix', () => {
  test('removes the prefix from the hash: #!about is the fragment /about', () => {
    window.history.replaceState({}, '', '/#!about');

    expect(new Dispatcher({ fragmentPrefix: '!' }).serverParams().fragment).toBe('/about');
  });

  test('dispatches navigateTo("#!about") when the prefix is written out', () => {
    const { dispatcher, seen } = startDispatcher({ fragmentPrefix: '!' }, 'fragment');
    dispatcher.navigateTo('#!about');

    expect(seen).toEqual(['200:start', '200:about']);
  });

  test('is not added by navigateTo, so navigateTo("#about") gives 404 (audit pilot F27)', () => {
    const { dispatcher, seen } = startDispatcher({ fragmentPrefix: '!' }, 'fragment');
    dispatcher.navigateTo('#about');

    expect(window.location.hash).toBe('#about');
    expect(seen).toEqual(['200:start', '404:null']);
  });
});

describe('root', () => {
  test('navigateTo adds the root to the browser URL and dispatches the path without it', () => {
    const { dispatcher, seen } = startDispatcher({ root: '/app' }, 'path');
    dispatcher.navigateTo('/about');

    expect(window.location.pathname).toBe('/app/about');
    expect(seen.at(-1)).toBe('200:about');
  });
});

describe('form helpers', () => {
  // getFormMethod reads the form that the dispatcher last caught (this.#form), not its argument.
  test('getFormMethod ignores its argument and returns GET when no form was caught (audit pilot F19)', () => {
    document.body.innerHTML = '<form method="post"></form><form method="post" data-method="put"></form>';
    const dispatcher = new Dispatcher();

    expect(dispatcher.getFormMethod(document.forms[0])).toBe('GET');
    expect(dispatcher.getFormMethod(document.forms[1])).toBe('GET');
  });

  test('getFormData returns the fields of the form that is the event target', () => {
    document.body.innerHTML = '<form id="form"><input name="name" value="Ada"></form>';

    expect(new Dispatcher().getFormData({ target: document.getElementById('form') })).toEqual({ name: 'Ada' });
  });

  test('getFormData finds the closest form from an element inside it', () => {
    document.body.innerHTML = '<form><input name="name" value="Ada"><button id="send">Send</button></form>';

    expect(new Dispatcher().getFormData({ target: document.getElementById('send') })).toEqual({ name: 'Ada' });
  });

  test('getFormData throws when the target is not inside a form', () => {
    document.body.innerHTML = '<div id="outside"></div>';

    expect(() => new Dispatcher().getFormData({ target: document.getElementById('outside') }))
      .toThrow('unable to locate a valid closest form element');
  });
});
