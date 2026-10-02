// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { Router, Dispatcher } from '../src/index';

// One dispatcher for the whole file: each dispatcher() call adds a window popstate
// listener that cannot be removed through the public API (audit pilot F15).
let dispatcher;
let responses = [];

/**
 * Wait until the browser has fired popstate and the dispatcher has handled it.
 * history.back() and history.forward() are asynchronous.
 * @return {Promise<void>}
 */
function nextPopstate() {
  return new Promise((resolve) => {
    window.addEventListener('popstate', () => setTimeout(resolve, 0), { once: true });
  });
}

beforeAll(() => {
  const router = new Router();
  router.get('/', 'start');
  router.get('/about', 'about');
  router.get('/search', 'search');
  router.post('/contact', 'contact');
  dispatcher = new Dispatcher();
  dispatcher.dispatcher(router, dispatcher.serverParams('path'), (data) => {
    responses.push(data);
  });
});

beforeEach(() => {
  responses = [];
});

describe('back and forward', () => {
  test('back dispatches the previous route and restores its URL', async () => {
    dispatcher.navigateTo('/');
    dispatcher.navigateTo('/about');

    const popstate = nextPopstate();
    window.history.back();
    await popstate;

    expect(window.location.pathname).toBe('/');
    expect(responses.map((response) => response.controller)).toEqual(['start', 'about', 'start']);
  });

  test('forward dispatches the next route again', async () => {
    dispatcher.navigateTo('/');
    dispatcher.navigateTo('/about');
    let popstate = nextPopstate();
    window.history.back();
    await popstate;

    popstate = nextPopstate();
    window.history.forward();
    await popstate;

    expect(window.location.pathname).toBe('/about');
    expect(responses.map((response) => response.controller)).toEqual(['start', 'about', 'start', 'about']);
  });

  test('back restores the GET query of the previous page', async () => {
    dispatcher.navigateTo('/search', { q: 'sofa' });
    dispatcher.navigateTo('/about');

    const popstate = nextPopstate();
    window.history.back();
    await popstate;

    const { controller, request } = responses.at(-1);
    expect(window.location.search).toBe('?q=sofa');
    expect(controller).toBe('search');
    expect(request.get.get('q')).toBe('sofa');
  });

  test('back to a page reached by postTo dispatches the POST again with the same data (audit pilot F30)', async () => {
    dispatcher.postTo('/contact', { name: 'Ada' });
    dispatcher.navigateTo('/about');

    const popstate = nextPopstate();
    window.history.back();
    await popstate;

    const { verb, controller, request } = responses.at(-1);
    expect(verb).toBe('POST');
    expect(controller).toBe('contact');
    expect(request.post).toEqual({ name: 'Ada' });
  });
});

// update() calls refresh(), which dispatches the current history entry again.
describe('state update after navigation (audit pilot F28, fixed)', () => {
  test('adds no history entry and dispatches the current route again', () => {
    dispatcher.navigateTo('/about');
    const lengthBefore = window.history.length;

    dispatcher.getStateHandler().update({ count: 1 });

    expect(window.history.length).toBe(lengthBefore);
    expect(window.location.pathname).toBe('/about');
    expect(responses.map((response) => response.controller)).toEqual(['about', 'about']);
  });

  test('after back, dispatches the page that is shown and stays there', async () => {
    dispatcher.navigateTo('/');
    dispatcher.navigateTo('/about');
    const popstate = nextPopstate();
    window.history.back();
    await popstate;
    const lengthBefore = window.history.length;

    dispatcher.getStateHandler().update({ count: 1 });

    expect(window.location.pathname).toBe('/');
    expect(window.history.length).toBe(lengthBefore);
    expect(responses.at(-1).controller).toBe('start');
  });

  test('after back, the GET query of the shown page is dispatched again', async () => {
    dispatcher.navigateTo('/search', { q: 'sofa' });
    dispatcher.navigateTo('/about');
    const popstate = nextPopstate();
    window.history.back();
    await popstate;

    dispatcher.getStateHandler().update({ count: 1 });

    const { controller, request } = responses.at(-1);
    expect(controller).toBe('search');
    expect(request.get.get('q')).toBe('sofa');
  });

  test('after back, forward still reaches the next page', async () => {
    dispatcher.navigateTo('/');
    dispatcher.navigateTo('/about');
    let popstate = nextPopstate();
    window.history.back();
    await popstate;
    dispatcher.getStateHandler().update({ count: 1 });

    popstate = nextPopstate();
    window.history.forward();
    await popstate;

    expect(window.location.pathname).toBe('/about');
    expect(responses.at(-1).controller).toBe('about');
  });
});
