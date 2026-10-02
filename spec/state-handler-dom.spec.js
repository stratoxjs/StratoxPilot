// @vitest-environment happy-dom
import { beforeEach, describe, expect, test } from 'vitest';
import StateHandler from '../src/StateHandler';

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

  test('refresh after pushState adds another history entry (audit pilot F28)', () => {
    const handler = new StateHandler();
    handler.on('popstate', () => {});
    handler.pushState('/page', { count: 1 });
    const lengthBefore = window.history.length;

    handler.refresh();

    expect(window.history.length).toBe(lengthBefore + 1);
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

  test('off() removes only the last window listener and leaves all handlers for emit (audit pilot F15)', () => {
    const handler = new StateHandler();
    const calls = [];
    handler.on('off-event', () => calls.push('first'));
    handler.on('off-event', () => calls.push('second'));

    expect(handler.off('off-event')).toBe(true);
    window.dispatchEvent(new Event('off-event'));
    expect(calls).toEqual(['first']);

    handler.emit('off-event', {});
    expect(calls).toEqual(['first', 'first', 'second']);
  });
});
