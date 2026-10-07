// @vitest-environment happy-dom
import {
  afterEach, beforeAll, beforeEach, describe, expect, test,
} from 'vitest';
import { Router, Dispatcher } from '../src/index';

// D-047 (V-13): with catchLinks, a click on a same-origin link navigates through the
// dispatcher instead of loading a page. Everything the browser should handle itself is left alone.

/**
 * Create the routes used by every link test.
 * @return {Router}
 */
function createRouter() {
  const router = new Router();
  router.get('/', 'start');
  router.get('/about', 'about');
  router.get('/search', 'search');
  return router;
}

// Records whether the page's own handlers prevented the click, then stops the test
// environment from following the link.
let preventedBeforeWindow = null;
const recordAndStop = (event) => {
  preventedBeforeWindow = event.defaultPrevented;
  event.preventDefault();
};

/**
 * Click an element the way a browser does.
 * @param  {string} selector
 * @param  {object} options  MouseEvent options, e.g. { ctrlKey: true }
 * @return {boolean} true when the dispatcher took the click
 */
function clickLink(selector, options = {}) {
  preventedBeforeWindow = null;
  document.querySelector(selector).dispatchEvent(new MouseEvent('click', {
    bubbles: true, cancelable: true, button: 0, ...options,
  }));
  return preventedBeforeWindow;
}

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  window.addEventListener('click', recordAndStop);
  document.body.innerHTML = `
    <a id="about" href="/about">About</a>
    <a id="search" href="/search?q=sofa">Search</a>
    <a id="nested" href="/about"><span><b>About</b></span></a>
    <a id="external" href="https://other.example/about">Other site</a>
    <a id="blank" href="/about" target="_blank">New tab</a>
    <a id="self" href="/about" target="_self">Same tab</a>
    <a id="download" href="/about" download>Download</a>
    <a id="ignored" href="/about" data-pilot-ignore>Load page</a>
    <a id="anchor" href="#top">Top</a>
    <a id="no-href">No href</a>`;
});

afterEach(() => {
  window.removeEventListener('click', recordAndStop);
});

// Runs first: the catchLinks listener added below is on document and cannot be removed
// through the public API, so it would take these clicks too.
describe('without catchLinks', () => {
  test('does not take link clicks', () => {
    const dispatcher = new Dispatcher();
    dispatcher.dispatcher(createRouter(), dispatcher.serverParams('path'), () => {});

    expect(clickLink('#about')).toBe(false);
  });
});

describe('with catchLinks', () => {
  let responses = [];

  beforeAll(() => {
    const dispatcher = new Dispatcher({ catchLinks: true });
    dispatcher.dispatcher(createRouter(), dispatcher.serverParams('path'), (data) => {
      responses.push(data);
    });
  });

  beforeEach(() => {
    responses = [];
  });

  test('a same-origin link navigates through the dispatcher', () => {
    expect(clickLink('#about')).toBe(true);

    expect(window.location.pathname).toBe('/about');
    expect(responses.at(-1).controller).toBe('about');
  });

  test('the link\'s query becomes the request', () => {
    expect(clickLink('#search')).toBe(true);

    expect(window.location.pathname + window.location.search).toBe('/search?q=sofa');
    expect(responses.at(-1).request.get.get('q')).toBe('sofa');
  });

  test('a click on an element inside the link counts', () => {
    expect(clickLink('#nested b')).toBe(true);
    expect(responses.at(-1).controller).toBe('about');
  });

  test('target="_self" counts as the same tab', () => {
    expect(clickLink('#self')).toBe(true);
  });

  test.each([
    ['another origin', '#external', {}],
    ['target="_blank"', '#blank', {}],
    ['download', '#download', {}],
    ['data-pilot-ignore', '#ignored', {}],
    ['an in-page anchor', '#anchor', {}],
    ['a link without href', '#no-href', {}],
    ['Ctrl', '#about', { ctrlKey: true }],
    ['Cmd', '#about', { metaKey: true }],
    ['Shift', '#about', { shiftKey: true }],
    ['Alt', '#about', { altKey: true }],
    ['the middle button', '#about', { button: 1 }],
  ])('leaves %s to the browser', (name, selector, options) => {
    expect(clickLink(selector, options)).toBe(false);
    expect(responses).toEqual([]);
  });

  test('leaves a click that another handler already prevented', () => {
    const takeIt = (event) => event.preventDefault();
    document.getElementById('about').addEventListener('click', takeIt);

    clickLink('#about');

    expect(responses).toEqual([]);
  });
});
