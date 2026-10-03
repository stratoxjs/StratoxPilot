import {
  afterAll, beforeAll, beforeEach, describe, expect, test,
} from 'vitest';
import { Router, Dispatcher } from '../../src/index';

// Roadmap 2.13: critical paths in real browsers (Chromium, Firefox, WebKit), run with
// `npm run test:browser`: back and forward through the history, and form catching.
// The dispatcher matches request('path'), so the routes do not depend on the URL of
// the test frame. pushState changes that URL; it is restored after the file.

let dispatcher;
let responses = [];
let startUrl;

/**
 * Wait until the browser has fired popstate and the dispatcher has handled it.
 * @return {Promise<void>}
 */
function nextPopstate() {
  return new Promise((resolve) => {
    window.addEventListener('popstate', () => setTimeout(resolve, 0), { once: true });
  });
}

/**
 * Go back or forward in the history and wait for the dispatch.
 * @param  {number} steps -1 for back, 1 for forward
 * @return {Promise<void>}
 */
async function go(steps) {
  const popstate = nextPopstate();
  window.history.go(steps);
  await popstate;
}

/**
 * Submit a form the way a user does and report whether pilot prevented leaving the page.
 * A window listener runs after pilot's document listener; it records the result and then
 * cancels the submit, so the test page never navigates.
 * @param  {string} id form id
 * @return {boolean} true when pilot caught the submit
 */
function submit(id) {
  let caught;
  const guard = (event) => {
    caught = event.defaultPrevented;
    event.preventDefault();
  };
  window.addEventListener('submit', guard);
  document.getElementById(id).requestSubmit();
  window.removeEventListener('submit', guard);
  return caught;
}

beforeAll(() => {
  startUrl = window.location.href;
  const router = new Router();
  router.get('/', 'start');
  router.get('/about', 'about');
  router.get('/search', 'search');
  router.post('/contact', 'contact');
  dispatcher = new Dispatcher({ catchForms: true });
  dispatcher.dispatcher(router, dispatcher.request('path'), (response) => {
    responses.push(response);
  });
});

afterAll(() => {
  dispatcher.getStateHandler().off('popstate');
  window.history.replaceState(null, '', startUrl);
});

beforeEach(() => {
  responses = [];
});

describe('back and forward', () => {
  test('back dispatches the previous route from the history; forward the next one', async () => {
    dispatcher.navigateTo('/');
    dispatcher.navigateTo('/about');

    await go(-1);
    expect(window.location.pathname).toBe('/');
    await go(1);
    expect(window.location.pathname).toBe('/about');

    expect(responses.map((response) => [response.controller, response.fromHistory])).toEqual([
      ['start', false],
      ['about', false],
      ['start', true],
      ['about', true],
    ]);
  });

  test('back restores the GET query of the previous page', async () => {
    dispatcher.navigateTo('/search', { q: 'sofa' });
    dispatcher.navigateTo('/about');

    await go(-1);

    const { controller, request } = responses.at(-1);
    expect(window.location.search).toBe('?q=sofa');
    expect(controller).toBe('search');
    expect(request.get.get('q')).toBe('sofa');
  });

  test('back to a page reached by postTo dispatches the POST again, marked fromHistory (audit pilot F30)', async () => {
    dispatcher.postTo('/contact', { name: 'Ada' });
    dispatcher.navigateTo('/about');

    await go(-1);

    const { verb, controller, request, fromHistory } = responses.at(-1);
    expect([verb, controller, fromHistory]).toEqual(['POST', 'contact', true]);
    expect(request.post).toEqual({ name: 'Ada' });
  });

  test('a state update after back adds no history entry and dispatches the page shown (audit pilot F28)', async () => {
    dispatcher.navigateTo('/');
    dispatcher.navigateTo('/about');
    await go(-1);
    const length = window.history.length;

    dispatcher.getStateHandler().update({ count: 1 });

    expect(window.history.length).toBe(length);
    expect(window.location.pathname).toBe('/');
    expect(responses.at(-1).controller).toBe('start');
  });
});

describe('form catching', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="get" action="/search" method="get"><input name="q" value="sofa"></form>
      <form id="post" action="/contact" method="post"><input name="name" value="Ada"></form>
      <form id="external" action="https://other.example/x" method="get"><input name="a" value="1"></form>`;
  });

  test('a GET form is caught and dispatched with its fields as the query', () => {
    expect(submit('get')).toBe(true);

    const { controller, request } = responses.at(-1);
    expect(controller).toBe('search');
    expect(request.get.get('q')).toBe('sofa');
    expect(window.location.pathname).toBe('/search');
  });

  test('a POST form is caught and dispatched to the POST route with its fields', () => {
    expect(submit('post')).toBe(true);

    const { verb, controller, request } = responses.at(-1);
    expect([verb, controller]).toEqual(['POST', 'contact']);
    expect(request.post).toEqual({ name: 'Ada' });
  });

  test('a form for another site is not caught (audit pilot F16)', () => {
    expect(submit('external')).toBe(false);
    expect(responses).toEqual([]);
  });
});
