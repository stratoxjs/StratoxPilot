// @vitest-environment happy-dom
import { beforeEach, describe, expect, test } from 'vitest';
import StateHandler from '../src/StateHandler';
import { Router, Dispatcher } from '../src/index';

beforeEach(() => {
  window.history.replaceState({}, '', '/');
});

describe('history', () => {
  test('pushState adds a browser history entry with the path and state', () => {
    const handler = new StateHandler();
    handler.on('popstate', () => {});
    const lengthBefore = window.history.length;

    handler.pushState('/page', { count: 1 });

    expect(window.location.pathname).toBe('/page');
    expect(window.history.state).toEqual({ count: 1 });
    expect(window.history.length).toBe(lengthBefore + 1);
  });

  test('pushState leaves the browser history alone with module: false', () => {
    const handler = new StateHandler({}, { module: false });
    handler.on('popstate', () => {});
    const lengthBefore = window.history.length;

    handler.pushState('/page', {});

    expect(window.location.pathname).toBe('/');
    expect(window.history.length).toBe(lengthBefore);
  });

  test('refresh after pushState adds no history entry (audit pilot F28, fixed)', () => {
    const handler = new StateHandler();
    handler.on('popstate', () => {});
    handler.pushState('/page', { count: 1 });
    const lengthBefore = window.history.length;

    handler.refresh();

    expect(window.history.length).toBe(lengthBefore);
    expect(window.location.pathname).toBe('/page');
  });

  test('refresh after pushState emits the state of the current history entry (audit pilot F28, fixed)', () => {
    const handler = new StateHandler();
    const states = [];
    handler.on('popstate', (event) => states.push(event.state));
    handler.pushState('/page', { count: 1 });
    window.history.replaceState({ count: 2 }, '', '/other');

    handler.refresh();

    expect(states).toEqual([{ count: 1 }, { count: 2 }]);
  });

  test('refresh with module: false emits the last pushed state and leaves the history alone', () => {
    const handler = new StateHandler({}, { module: false });
    const states = [];
    handler.on('popstate', (event) => states.push(event.state));
    handler.pushState('/page', { count: 1 });
    const lengthBefore = window.history.length;

    handler.refresh();

    expect(states).toEqual([{ count: 1 }, { count: 1 }]);
    expect(window.history.length).toBe(lengthBefore);
  });
});

describe('window events', () => {
  test('on() also listens for the event on window', () => {
    const handler = new StateHandler({ a: 1 });
    const details = [];
    handler.on('custom-event', (event) => details.push(event.details));

    window.dispatchEvent(new Event('custom-event'));

    expect(details).toEqual([{ a: 1 }]);
  });

  test('a browser popstate event reaches the handler with its state in details', () => {
    const handler = new StateHandler({ a: 1 });
    const details = [];
    handler.on('popstate', (event) => details.push(event.details));

    window.dispatchEvent(new PopStateEvent('popstate', { state: { b: 2 } }));

    expect(details).toEqual([{ a: 1, b: 2 }]);
  });

  test('on() does not listen on window with module: false', () => {
    const handler = new StateHandler({}, { module: false });
    const calls = [];
    handler.on('module-off-event', () => calls.push('called'));

    window.dispatchEvent(new Event('module-off-event'));

    expect(calls).toEqual([]);
  });

  test('off() returns false for an event without handlers', () => {
    expect(new StateHandler().off('no-such-event')).toBe(false);
  });

  test('off() removes every window listener of the event (audit pilot F15, fixed)', () => {
    const handler = new StateHandler();
    const calls = [];
    handler.on('off-event', () => calls.push('first'));
    handler.on('off-event', () => calls.push('second'));

    expect(handler.off('off-event')).toBe(true);
    window.dispatchEvent(new Event('off-event'));

    expect(calls).toEqual([]);
  });

  test('off() removes every handler, so emit finds none (audit pilot F15, fixed)', () => {
    const handler = new StateHandler();
    handler.on('off-emit-event', () => {});
    handler.on('off-emit-event', () => {});

    handler.off('off-emit-event');

    expect(() => handler.emit('off-emit-event', {}))
      .toThrow('Trying to emit to an event (off-emit-event) that does not yet exist.');
  });

  test('on() after off() starts again with only the new handler (audit pilot F15, fixed)', () => {
    const handler = new StateHandler();
    const calls = [];
    handler.on('again-event', () => calls.push('old'));
    handler.off('again-event');
    handler.on('again-event', () => calls.push('new'));

    window.dispatchEvent(new Event('again-event'));
    handler.emit('again-event', {});

    expect(calls).toEqual(['new', 'new']);
  });

  test('off() leaves other events alone', () => {
    const handler = new StateHandler();
    const calls = [];
    handler.on('removed-event', () => calls.push('removed'));
    handler.on('kept-event', () => calls.push('kept'));

    handler.off('removed-event');
    window.dispatchEvent(new Event('kept-event'));
    handler.emit('kept-event', {});

    expect(calls).toEqual(['kept', 'kept']);
  });

  test('off() with module: false removes the handlers and returns true (audit pilot F15, fixed)', () => {
    const handler = new StateHandler({}, { module: false });
    handler.on('module-off-remove', () => {});

    expect(handler.off('module-off-remove')).toBe(true);
    expect(() => handler.emit('module-off-remove', {})).toThrow('does not yet exist');
  });

  test('a dispatcher stops dispatching after off("popstate")', async () => {
    const router = new Router();
    router.get('/', 'start');
    const dispatcher = new Dispatcher();
    const responses = [];
    dispatcher.dispatcher(router, dispatcher.serverParams('path'), (response) => responses.push(response));

    dispatcher.getStateHandler().off('popstate');
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));

    expect(responses.map((response) => response.controller)).toEqual(['start']);
  });
});
