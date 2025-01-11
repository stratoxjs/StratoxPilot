import { expect, test } from 'vitest'
import { Router, Dispatcher } from '../src/index';

const router = new Router();
const dispatcher = new Dispatcher();

// Init routes
router.get('/', true);
router.get('/{type:a}/{page:test}/{id:[0-9]+}', true);
router.get('/{type:a}/{page:test}/{id:[a-z]+}', true);
router.get('/{type:b}/{page:.+}', true);
router.get('/{type:c}/{page:[^/]+}/test2', true);
router.post('/{type:d}/{page:contact}', true);

// Dispatching the triggerd tests
let hasNavigated = true;

dispatcher.dispatcher(router, dispatcher.request('path'), (data, status) => {

  test('Checking data types', () => {
    expect(typeof data.verb).toBe('string');
    expect(typeof data.status).toBe('number');
    expect(typeof data.path).toBe('object');
    expect(typeof data.vars).toBe('object');
    expect(typeof data.request).toBe('object');
  });

  test('Expects status 200', () => {
    expect(status).toBe(200);
  });

  test('Has controller', () => {
    expect(data.controller).toBe(true);
  });

  test('Has navigated to new page', () => {
    expect(hasNavigated).toBe(true);
  });

  // Ignore start page
  if (data.path.length > 0) {
    hasNavigated = true;

    if (data.verb === 'POST') {
      test('Validating POST request', () => {
        expect(typeof data.request.post === 'object').toBe(true);
      });

      test('POST request param', () => {
        expect(data.request.post.param).toBe(10);
      });
    } else {
      test('Validating GET request', () => {
        expect(data.request.get instanceof URLSearchParams).toBe(true);
      });

      test('Get request param', () => {
        expect(data.request.get.get('param')).toBe('10');
      });
    }

    test('Check vars type is in place', () => {
      expect(typeof data.vars.type[0]).toBe('string');
    });

    if (data.vars.type[0] === 'b') {
      test('Check page vars length', () => {
        expect(data.vars.page.length).toBe(3);
      });
    }

  } else {
    hasNavigated = false;
  }
  

});

// Trigger tests
dispatcher.navigateTo('/a/test/12', { param: 10 });
dispatcher.navigateTo('/a/test/ab', { param: 10 });
dispatcher.navigateTo('/b/test/test2/test3', { param: 10 });
dispatcher.navigateTo('/c/test/test2', { param: 10 });
dispatcher.postTo('/d/contact', { param: 10 });
