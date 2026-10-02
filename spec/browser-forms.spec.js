// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { Router, Dispatcher } from '../src/index';

/**
 * Create the routes used by every form test.
 * @return {Router}
 */
function createRouter() {
  const router = new Router();
  router.get('/', 'start');
  router.get('/search', 'search');
  router.get('/x', 'local-x');
  router.post('/contact', 'contact');
  router.put('/contact', 'contact-put');
  return router;
}

/**
 * Submit a form the way a browser does and report whether the default action
 * (leaving the page) was prevented.
 * @param  {string} id form id
 * @return {boolean} true when the submit was intercepted
 */
function submitForm(id) {
  const event = new Event('submit', { bubbles: true, cancelable: true });
  document.getElementById(id).dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  document.body.innerHTML = `
    <form id="get" action="/search" method="get"><input name="q" value="sofa"></form>
    <form id="get-query" action="/search?page=2" method="get"><input name="q" value="sofa"></form>
    <form id="post" action="/contact" method="post"><input name="name" value="Ada"></form>
    <form id="put" action="/contact" method="post" data-method="put"><input name="name" value="Ada"></form>
    <form id="external" action="https://other.example/x" method="get"><input name="a" value="1"></form>
    <form id="external-post" action="https://other.example/contact" method="post"><input name="a" value="1"></form>
    <form id="other-port" action="${window.location.protocol}//${window.location.hostname}:1/x" method="get"></form>
    <form id="same-origin" action="${window.location.origin}/search" method="get"><input name="q" value="sofa"></form>`;
});

// Runs first: the catchForms listener added below is on document and cannot be
// removed through the public API, so it would intercept these submits too.
describe('without catchForms', () => {
  test('does not intercept form submits', () => {
    const dispatcher = new Dispatcher();
    dispatcher.dispatcher(createRouter(), dispatcher.serverParams('path'), () => {});

    expect(submitForm('get')).toBe(false);
  });
});

describe('with catchForms', () => {
  let responses = [];

  beforeAll(() => {
    const dispatcher = new Dispatcher({ catchForms: true });
    dispatcher.dispatcher(createRouter(), dispatcher.serverParams('path'), (data) => {
      responses.push(data);
    });
  });

  beforeEach(() => {
    responses = [];
  });

  test('a GET form navigates to its action with the fields as the query', () => {
    expect(submitForm('get')).toBe(true);

    const { verb, controller, request, form } = responses.at(-1);
    expect(window.location.pathname + window.location.search).toBe('/search?q=sofa');
    expect(verb).toBe('GET');
    expect(controller).toBe('search');
    expect(request.get.get('q')).toBe('sofa');
    expect(form).toBe(document.getElementById('get'));
  });

  test('a GET form keeps the query of its action and adds its fields', () => {
    submitForm('get-query');

    expect(window.location.search).toBe('?page=2&q=sofa');
    expect(responses.at(-1).request.get.toString()).toBe('page=2&q=sofa');
  });

  test('a POST form dispatches POST with its fields as the post object', () => {
    expect(submitForm('post')).toBe(true);

    const { verb, controller, request } = responses.at(-1);
    expect(window.location.pathname).toBe('/contact');
    expect(verb).toBe('POST');
    expect(controller).toBe('contact');
    expect(request.post).toEqual({ name: 'Ada' });
  });

  test('data-method="put" on a form dispatches PUT', () => {
    submitForm('put');

    const { verb, controller } = responses.at(-1);
    expect(verb).toBe('PUT');
    expect(controller).toBe('contact-put');
  });

  test('requestSubmit() is intercepted like a submit event', () => {
    document.getElementById('get').requestSubmit();

    expect(responses.at(-1).controller).toBe('search');
  });

  test('a form for another site is not intercepted and nothing is dispatched (audit pilot F16, fixed)', () => {
    expect(submitForm('external')).toBe(false);

    expect(window.location.pathname).toBe('/');
    expect(responses).toEqual([]);
  });

  test('a POST form for another site is not intercepted (audit pilot F16, fixed)', () => {
    expect(submitForm('external-post')).toBe(false);

    expect(responses).toEqual([]);
  });

  test('a form for the same host on another port is not intercepted (audit pilot F16, fixed)', () => {
    expect(submitForm('other-port')).toBe(false);

    expect(responses).toEqual([]);
  });

  test('a form with a full URL to this site is intercepted', () => {
    expect(submitForm('same-origin')).toBe(true);

    const { controller, request } = responses.at(-1);
    expect(controller).toBe('search');
    expect(request.get.get('q')).toBe('sofa');
  });
});
