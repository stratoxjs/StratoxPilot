// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { Router, Dispatcher } from '../src/index';

test('navigateTo pushes the path to the browser history and dispatches the matching route', () => {
  const router = new Router();
  router.get('/', 'start');
  router.get('/about', 'about');
  const dispatcher = new Dispatcher();
  const controllers = [];
  dispatcher.dispatcher(router, dispatcher.request('path'), (data) => {
    controllers.push(data.controller);
  });

  dispatcher.navigateTo('/about');

  expect(window.location.pathname).toBe('/about');
  expect(controllers).toEqual(['start', 'about']);
});
