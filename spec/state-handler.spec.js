import { beforeEach, describe, expect, test } from 'vitest';
import StateHandler from '../src/StateHandler';
import { Dispatcher } from '../src/index';

/**
 * The stored state is static and shared by every StateHandler (audit pilot F14).
 * pushState replaces it, which is the only way to reset it through the public API.
 */
function resetSharedState() {
  const handler = new StateHandler({}, { module: false });
  handler.on('popstate', () => {});
  handler.pushState('/', {});
}

/**
 * A StateHandler with a popstate listener that records every event.
 * @param  {object|function} state
 * @return {{ handler: StateHandler, events: object[] }}
 */
function listeningHandler(state = {}) {
  const handler = new StateHandler(state);
  const events = [];
  handler.on('popstate', (event) => events.push(event));
  return { handler, events };
}

beforeEach(() => {
  resetSharedState();
});

test('is the class that Dispatcher.getStateHandler() returns', () => {
  expect(new Dispatcher().getStateHandler()).toBeInstanceOf(StateHandler);
});

describe('events', () => {
  test('emit throws when no handler is registered for the event', () => {
    expect(() => new StateHandler().emit('popstate', {}))
      .toThrow('Trying to emit to an event (popstate) that does not yet exist.');
  });

  test('emit calls every handler for the event in order', () => {
    const handler = new StateHandler();
    const calls = [];
    handler.on('change', () => calls.push('first'));
    handler.on('change', () => calls.push('second'));

    handler.emit('change', {});

    expect(calls).toEqual(['first', 'second']);
  });

  test('a handler is called with this bound to the StateHandler', () => {
    const handler = new StateHandler();
    let self;
    handler.on('change', function record() { self = this; });

    handler.emit('change', {});

    expect(self).toBe(handler);
  });

  test('the event gets details: the handler state merged with event.state', () => {
    const handler = new StateHandler({ a: 'state', b: 'state' });
    let received;
    handler.on('change', (event) => { received = event; });

    handler.emit('change', { state: { b: 'event' }, other: 1 });

    expect(received).toEqual({
      state: { b: 'event' },
      other: 1,
      details: { a: 'state', b: 'event' },
    });
  });

  test('a non-object event becomes an empty event with details', () => {
    const handler = new StateHandler({ a: 1 });
    let received;
    handler.on('change', (event) => { received = event; });

    handler.emit('change', 'text');

    expect(received).toEqual({ details: { a: 1 } });
  });

  test('emitPopState emits popstate with an empty event', () => {
    const { handler, events } = listeningHandler({ a: 1 });

    handler.emitPopState();

    expect(events).toEqual([{ details: { a: 1 } }]);
  });

  test('off returns false without a window, and the handler stays registered (audit pilot F15)', () => {
    const handler = new StateHandler();
    const calls = [];
    handler.on('change', () => calls.push('called'));

    expect(handler.off('change')).toBe(false);
    handler.emit('change', {});
    expect(calls).toEqual(['called']);
  });
});

describe('getState', () => {
  test('returns the state object given to the constructor', () => {
    const state = { a: 1 };

    expect(new StateHandler(state).getState()).toBe(state);
  });

  test('calls a state function with its argument', () => {
    const handler = new StateHandler((arg) => ({ fromFunction: true, arg }));

    expect(handler.getState({ q: 1 })).toEqual({ fromFunction: true, arg: { q: 1 } });
  });

  test('returns an empty object when the constructor got no state', () => {
    expect(new StateHandler().getState()).toEqual({});
    expect(new StateHandler('text').getState()).toEqual({});
  });
});

describe('pushState', () => {
  test.each([
    { argument: 'path', path: 5, state: {}, message: 'Argument 1 (path) in pushState method has to be a string' },
    { argument: 'state', path: '/', state: 'text', message: 'Argument 2 (state) in pushState method has to be a object' },
  ])('throws when the $argument argument has the wrong type', ({ path, state, message }) => {
    const { handler } = listeningHandler();

    expect(() => handler.pushState(path, state)).toThrow(message);
  });

  test('replaces the stored state and emits popstate with it', () => {
    const { handler, events } = listeningHandler({ a: 1 });

    handler.pushState('/page', { count: 1 });

    expect(handler.get()).toEqual({ count: 1 });
    expect(events).toEqual([{ state: { count: 1 }, details: { a: 1, count: 1 } }]);
  });

  test('uses an empty state when none is given', () => {
    const { handler } = listeningHandler();

    handler.pushState('/page');

    expect(handler.get()).toEqual({});
  });
});

describe('get', () => {
  test('returns the stored object itself, so changes to it are kept', () => {
    const handler = new StateHandler();
    handler.get().added = 1;

    expect(handler.get()).toEqual({ added: 1 });
  });

  test('returns the value for a key', () => {
    const handler = new StateHandler();
    handler.set({ count: 3 });

    expect(handler.get('count', 'default')).toBe(3);
  });

  test('returns the default for a missing key', () => {
    expect(new StateHandler().get('missing', 'default')).toBe('default');
  });

  test.each([
    ['0', 0],
    ['an empty string', ''],
    ['false', false],
    ['null', null],
    ['NaN', NaN],
  ])('returns the stored value %s, not the default (audit pilot F13, fixed)', (name, value) => {
    const handler = new StateHandler();
    handler.set({ value });

    expect(handler.get('value', 'default')).toBe(value);
  });

  test('returns a stored 0 for a numeric key (audit pilot F13, fixed)', () => {
    const handler = new StateHandler();
    handler.set(0, 0);

    expect(handler.get(0, 'default')).toBe(0);
  });

  test('returns the default when the stored value is undefined', () => {
    const handler = new StateHandler();
    handler.set({ value: undefined });

    expect(handler.get('value', 'default')).toBe('default');
  });

  test('shares the stored state between StateHandler instances (audit pilot F14)', () => {
    new StateHandler().set({ shared: 1 });

    expect(new StateHandler().get('shared')).toBe(1);
  });
});

describe('set, update and setDefault', () => {
  test('set merges an object into the state without emitting', () => {
    const { handler, events } = listeningHandler();
    handler.set({ a: 1 });
    handler.set({ b: 2 });

    expect(handler.get()).toEqual({ a: 1, b: 2 });
    expect(events).toEqual([]);
  });

  test('set with a key and a value sets that key', () => {
    const handler = new StateHandler();
    handler.set('name', 'Ada');
    handler.set(3, 'three');

    expect(handler.get()).toEqual({ name: 'Ada', 3: 'three' });
  });

  test('update merges into the state and emits popstate', () => {
    const { handler, events } = listeningHandler();

    handler.update({ a: 1 });

    expect(handler.get()).toEqual({ a: 1 });
    expect(events).toHaveLength(1);
  });

  test('update with refresh false does not emit', () => {
    const { handler, events } = listeningHandler();

    handler.update({ a: 1 }, undefined, false);

    expect(events).toEqual([]);
  });

  test('update throws when no popstate handler exists, because it emits', () => {
    expect(() => new StateHandler().update({ a: 1 }))
      .toThrow('Trying to emit to an event (popstate) that does not yet exist.');
  });

  test('setDefault adds only the keys that are missing', () => {
    const handler = new StateHandler();
    handler.set({ a: 1 });

    handler.setDefault({ a: 2, b: 3 });

    expect(handler.get()).toEqual({ a: 1, b: 3 });
  });

  test.each(['text', 5, undefined, null])('setDefault throws its own error for %j', (value) => {
    expect(() => new StateHandler().setDefault(value))
      .toThrow('The first argument of the Stratox builder "setDefault" must be an object!');
  });

  test('setDefault(null) throws its own error, not a TypeError (audit pilot F29, fixed)', () => {
    expect(() => new StateHandler().setDefault(null)).not.toThrow(TypeError);
  });
});

describe('refresh', () => {
  test('emits popstate with the given state when pushState has not run', () => {
    const handler = new StateHandler({ a: 1 });
    const events = [];
    handler.on('popstate', (event) => events.push(event));

    handler.refresh({ b: 2 });

    expect(events).toEqual([{ state: { b: 2 }, details: { a: 1, b: 2 } }]);
  });

  test('emits the last pushed state again and ignores its argument once pushState has run (audit pilot F28: the argument part is unchanged)', () => {
    const { handler, events } = listeningHandler();
    handler.pushState('/page', { count: 1 });

    handler.refresh({ ignored: true });

    expect(events.map((event) => event.state)).toEqual([{ count: 1 }, { count: 1 }]);
  });

  test('throws when the state is not an object', () => {
    const { handler } = listeningHandler();

    expect(() => handler.refresh('text')).toThrow('Argument 1 (state) in pushState method has to be a object');
  });

  test('refreshState is the same as refresh', () => {
    const { handler, events } = listeningHandler();

    handler.refreshState({ b: 2 });

    expect(events.map((event) => event.state)).toEqual([{ b: 2 }]);
  });
});
