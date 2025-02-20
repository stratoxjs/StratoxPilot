/**
 * Stratox State handler
 * Author: Daniel Ronkainen
 * Apache License Version 2.0
 */
export default class StateHandler {
  #state = {};

  #config = {};

  #handlers = {};

  #unbind = {};

  #currentState;

  static #stateObject = {};

  constructor(state, config = {}) {
    if (typeof state === 'function' || typeof state === 'object') {
      this.#state = state;
    }
    this.#config = { module: true, ...config };
  }

  /**
   * Start event
   * @param  {string} eventName
   * @param  {callable} handler
   * @return {void}
   */
  on(eventName, handler) {
    if (!this.#handlers[eventName]) this.#handlers[eventName] = [];
    const hand = this.#eventHandler(eventName, handler.bind(this));
    this.#handlers[eventName].push(hand);
  }

  /**
   * Un bind / remove event
   * @param  {string} eventName
   * @return {bool}
   */
  off(eventName) {
    if (typeof this.#unbind[eventName] === 'function') {
      this.#unbind[eventName]();
      return true;
    }
    return false;
  }

  /**
   * Emit handler event
   * @param  {string} eventName
   * @param  {mixed} data       Data to pass to event
   * @return {void}
   */
  emit(eventName, data) {
    if (typeof this.#handlers[eventName] !== 'object') {
      throw new Error(`Trying to emit to an event (${eventName}) that does not yet exist. If you are trying to navigate the page, then this should be done after the dispatcher.`);
    }

    this.#handlers[eventName].forEach((handler) => {
      handler(data);
    });
  }

  /**
   * Will only emit sate and avoid to browse communication
   * @return {void}
   */
  emitPopState() {
    this.emit('popstate', {});
  }

  /**
   * Push to event state
   * @param  {string} path
   * @param  {object} state
   * @param  {string} titleArg
   * @return {void}
   */
  pushState(path, stateArg, titleArg) {
    const titleStr = (typeof titleArg === 'string') ? titleArg : '';
    const state = (stateArg === undefined) ? {} : stateArg;
    if (typeof path !== 'string') {
      throw new Error('Argument 1 (path) in pushState method has to be a string');
    }
    if (typeof state !== 'object') {
      throw new Error('Argument 2 (state) in pushState method has to be a object');
    }

    this.#currentState = () => {
      StateHandler.#stateObject = state;
      if (typeof window !== 'undefined' && this.#config.module && typeof window.history === 'object') {
        window.history.pushState(state, titleStr, path);
      }
      this.emit('popstate', { state });
    };

    this.#currentState();
  }

  /**
   * Get the active state object
   * @return {object}
   */
  get(key, defaultVal) {
    /*
    if (this.#config.module && typeof window.history === 'object') {
      return window.history?.state;
    }
    */
    if(typeof key === "string" || typeof key === "number") {
      return (StateHandler.#stateObject?.[key]) ? StateHandler.#stateObject[key] : defaultVal;
    }
    return StateHandler.#stateObject;
  }

  /**
   * Refresh the current state
   * @param  {object} state
   * @return {void}
   */
  refresh(state = {}) {
    if (typeof state !== 'object') {
      throw new Error('Argument 1 (state) in pushState method has to be a object');
    }
    if (typeof this.#currentState === 'function') {
      this.#currentState();
    } else {
      this.emit('popstate', { state });
    }
  }

  refreshState(state = {}) {
    this.refresh(state);
  }

  /**
   * Update the state
   * @param  {Object} addStates
   * @return {void}
   */
  update(addStates = {}, defaultVal, refresh) {
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
   * @param {Object} addStates
   * @param {Object} defaultStates
   */
  set(addStates = {}, defaultVal) {
    this.update(addStates, defaultVal, false);
  }

  /**
   * Set default states
   * @param {Object} addStates
   */
  setDefault(defaultArg) {
    if (typeof defaultArg !== 'object') {
      throw new Error('The first argument of the Stratox builder "setDefault" must be an object!');
    }
    const state = this.get();
    Object.entries(defaultArg).forEach(([key, row]) => {
      if (!(key in state)) {
        state[key] = defaultArg[key];
      }
    });
  }

  /**
   * Get state
   * @param  {object} state
   * @return {object}
   */
  getState(state) {
    if (typeof this.#state === 'function' || this.#state === 'object') {
      return this.#state(state);
    }
    return (typeof this.#state === 'object') ? this.#state : {};
  }

  /**
   * Get and merge states
   * @param  {object} state
   * @return {object}
   */
  #states(state) {
    return { ...this.getState(state), ...state };
  }

  /**
   * Create event
   * @param  {string}   eventName
   * @param  {callable} cb
   * @return {callable}
   */
  #eventHandler(eventName, cb) {
    const inst = this;
    const handler = (eventArg) => {
      let event = eventArg;
      if (typeof event !== 'object') event = {};
      event.details = inst.#states((event.state ?? {}));
      return cb(event);
    };

    if (this.#config.module && typeof window === 'object') {
      window.addEventListener(eventName, handler);
      this.#unbind[eventName] = () => window.removeEventListener(eventName, handler);
    }
    return handler;
  }
}
