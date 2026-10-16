/**
 * Stratox State handler
 * Author: Daniel Ronkainen
 * Apache License Version 2.0
 */

/** A state object: what pushState, get, set, update and setDefault work with. */
export type State = Record<string, unknown>;

/** The constructor's state: an object, or a function that gets the event's state and returns one. */
export type StateSource = State | ((state?: State) => State);

/** Options for a StateHandler. */
export interface StateHandlerConfig {
  /** Write to window.history and listen on window, when there is one (default true). */
  module?: boolean;
}

/**
 * What an event handler gets: the data passed to emit(), or the browser's event, with `details`
 * added: the constructor's state merged with `state`.
 */
export interface StateEvent {
  state?: State | null;
  details: State;
  [key: string]: unknown;
}

/** A handler given to on(); it runs with `this` set to the StateHandler. */
export type EventHandler = (this: StateHandler, event: StateEvent) => unknown;

/** A handler as it is stored and added to window: it takes the emitted data or the browser's event. */
type Listener = (eventArg: unknown) => unknown;

export default class StateHandler {
  #state: StateSource = {};

  #config: StateHandlerConfig = {};

  #handlers: Record<string, Listener[]> = {};

  #unbind: Record<string, (() => void)[]> = {};

  #currentState: State | undefined;

  // The state that get, set, update and setDefault use; each handler, so each dispatcher, has its own (F14, D-050)
  #stateObject: State = {};

  constructor(state?: StateSource, config: StateHandlerConfig = {}) {
    if (typeof state === 'function' || typeof state === 'object') {
      this.#state = state;
    }
    this.#config = { module: true, ...config };
  }

  /**
   * Start event
   * @param  eventName
   * @param  handler
   */
  on(eventName: string, handler: EventHandler): void {
    if (!this.#handlers[eventName]) this.#handlers[eventName] = [];
    const listener = this.#eventHandler(eventName, handler.bind(this));
    this.#handlers[eventName].push(listener);
  }

  /**
   * Un bind / remove event: all of its handlers and window listeners (audit F15)
   * @param  eventName
   * @return false when the event had no handlers
   */
  off(eventName: string): boolean {
    const hadHandlers = Array.isArray(this.#handlers[eventName]);
    (this.#unbind[eventName] ?? []).forEach((unbind) => unbind());
    delete this.#unbind[eventName];
    delete this.#handlers[eventName];
    return hadHandlers;
  }

  /**
   * Emit handler event
   * @param  eventName
   * @param  data       Data to pass to event
   */
  emit(eventName: string, data?: unknown): void {
    if (typeof this.#handlers[eventName] !== 'object') {
      throw new Error(`Trying to emit to an event (${eventName}) that does not yet exist. If you are trying to navigate the page, then this should be done after the dispatcher.`);
    }

    this.#handlers[eventName].forEach((handler) => {
      handler(data);
    });
  }

  /**
   * Will only emit sate and avoid to browse communication
   */
  emitPopState(): void {
    this.emit('popstate', {});
  }

  /**
   * Push to event state
   * @param  path
   * @param  stateArg
   * @param  titleArg
   */
  pushState(path: string, stateArg?: State, titleArg?: string): void {
    const titleStr = (typeof titleArg === 'string') ? titleArg : '';
    const state = (stateArg === undefined) ? {} : stateArg;
    if (typeof path !== 'string') {
      throw new Error('Argument 1 (path) in pushState method has to be a string');
    }
    if (typeof state !== 'object') {
      throw new Error('Argument 2 (state) in pushState method has to be a object');
    }

    this.#currentState = state;
    this.#stateObject = state;
    if (this.#usesBrowserHistory()) {
      window.history.pushState(state, titleStr, path);
    }
    this.emit('popstate', { state });
  }

  /**
   * Get the active state object, or one value of it
   */
  get(): State;
  get(key: string | number, defaultVal?: unknown): unknown;
  get(key?: string | number, defaultVal?: unknown): unknown {
    /*
    if (this.#config.module && typeof window.history === 'object') {
      return window.history?.state;
    }
    */
    if(typeof key === "string" || typeof key === "number") {
      // Only a missing value gives the default; a stored 0, '', false or null is returned (audit F13)
      const value = this.#stateObject?.[key];
      return (value === undefined) ? defaultVal : value;
    }
    return this.#stateObject;
  }

  /**
   * Refresh the current state: emit popstate again without adding a history entry (audit F28).
   * Once pushState has run, the state of the current history entry is used and the argument is ignored.
   * @param  state  Used only before the first pushState
   */
  refresh(state: State = {}): void {
    if (typeof state !== 'object') {
      throw new Error('Argument 1 (state) in pushState method has to be a object');
    }
    if (this.#currentState === undefined) {
      this.emit('popstate', { state });
    } else {
      this.emit('popstate', { state: this.#currentEntryState() });
    }
  }

  refreshState(state: State = {}): void {
    this.refresh(state);
  }

  /**
   * Update the state
   * @param  addStates   An object to merge in, or the key to set to defaultVal
   * @param  defaultVal
   * @param  refresh     false skips the refresh
   */
  update(addStates: State | string | number = {}, defaultVal?: unknown, refresh?: boolean): void {
    const state = this.get();
    if(typeof addStates === "string" || typeof addStates === "number") {
      state[addStates] = defaultVal;
    } else {
      Object.assign(state, addStates);
    }
    if(refresh !== false) {
      this.refresh();
    }
  }

  /**
   * Set state
   * @param addStates   An object to merge in, or the key to set to defaultVal
   * @param defaultVal
   */
  set(addStates: State | string | number = {}, defaultVal?: unknown): void {
    this.update(addStates, defaultVal, false);
  }

  /**
   * Set default states
   * @param defaultArg  Values for the keys the state does not have yet
   */
  setDefault(defaultArg: State): void {
    if (typeof defaultArg !== 'object' || defaultArg === null) {
      throw new Error('The first argument of the Stratox builder "setDefault" must be an object!');
    }
    const state = this.get();
    Object.entries(defaultArg).forEach(([key]) => {
      if (!(key in state)) {
        state[key] = defaultArg[key];
      }
    });
  }

  /**
   * Get state
   * @param  state  Passed to the state function from the constructor
   */
  getState(state?: State): State {
    if (typeof this.#state === 'function') {
      return this.#state(state);
    }
    return (typeof this.#state === 'object') ? this.#state : {};
  }

  /**
   * Does this handler write to the browser history?
   */
  #usesBrowserHistory(): boolean | undefined {
    return typeof window !== 'undefined' && this.#config.module && typeof window.history === 'object';
  }

  /**
   * The state of the page that is shown now. In a browser that is the current history entry,
   * which after Back or Forward is not the last state pushed.
   */
  #currentEntryState(): State | null | undefined {
    return this.#usesBrowserHistory() ? window.history.state : this.#currentState;
  }

  /**
   * Get and merge states
   * @param  state
   */
  #states(state: State): State {
    return { ...this.getState(state), ...state };
  }

  /**
   * Create event
   * @param  eventName
   * @param  cb
   */
  #eventHandler(eventName: string, cb: (event: StateEvent) => unknown): Listener {
    const handler = (eventArg: unknown) => {
      // The emitted data or the browser's event gets `details`; an emitted null throws here
      let event = eventArg as Partial<StateEvent>;
      if (typeof event !== 'object') event = {};
      event.details = this.#states((event.state ?? {}));
      return cb(event as StateEvent);
    };

    if (this.#config.module && typeof window === 'object') {
      window.addEventListener(eventName, handler);
      if (!this.#unbind[eventName]) this.#unbind[eventName] = [];
      this.#unbind[eventName].push(() => window.removeEventListener(eventName, handler));
    }
    return handler;
  }
}
