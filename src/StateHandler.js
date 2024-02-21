/**
 * Stratox state handler
 * Author: Daniel Ronkainen
 * Apache License Version 2.0
 */
export class StateHandler {

    #state = {};
    #config = {};
    #handlers = {};
    #unbind = {};
    #currentState;

    constructor(state, config = {}) {
        if(typeof state === "function" || typeof state === "object") {
            this.#state = state;
        }
        this.#config = Object.assign({
            module: true
        }, config);
    }

    /**
     * Start event
     * @param  {string} eventName
     * @param  {callable} handler
     * @return {void}
     */
    on(eventName, handler) {
        if(!this.#handlers[eventName]) this.#handlers[eventName] = [];
        const hand = this.#eventHandler(eventName, handler.bind(this));
        this.#handlers[eventName].push(hand);    
    }

    /**
     * Un bind / remove event
     * @param  {string} eventName
     * @return {bool}
     */
    off(eventName) {
        if(typeof this.#unbind[eventName] === "function") {
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
        if(typeof this.#handlers[eventName] !== "object") {
            throw new Error("Trying to emit to an event ("+eventName+") does not yet exists. If you are trying to navigate the page then this should be done after the the dispatcher.");
        }
        for (const handler of this.#handlers[eventName]) {
            handler(data);
        }
    }

    /**
     * Will only emit sate and avoid to browse communication
     * @return {void}
     */
    emitPopState() {
        this.emit("popstate", {});
    }

    /**
     * Push to event state
     * @param  {string} path
     * @param  {object} state
     * @return {void}
     */
    pushState(path, state = {}) {

        if(typeof path !== "string") {
            throw new Error("Argument 1 (path) in pushState method has to be a string");
        }
        if(typeof state !== "object") {
            throw new Error("Argument 2 (state) in pushState method has to be a object");
        }

        this.#currentState = function() {
            if(this.#config.module && typeof history === "object") {
                history.pushState(state, '', path);
            }
            this.emit("popstate", {state: state});
        }

        this.#currentState();
    }

    /**
     * Refresh the current state
     * @param  {object} state
     * @return {void}
     */
    refreshState(state = {}) {
        if(typeof state !== "object") {
            throw new Error("Argument 1 (state) in pushState method has to be a object");
        }
        if(typeof this.#currentState === "function") {
            this.#currentState();
        } else {
            this.emit("popstate", {state: state});
        }
    }

    /**
     * Get state
     * @param  {object} state
     * @return {object}
     */
    getState(state) {
        if(typeof this.#state === "function" || this.#state === "object") {
            return this.#state(state);
        }
        return (typeof this.#state === "object") ? this.#state : {};
    }

    /**
     * Get and merge states
     * @param  {object} state
     * @return {object}
     */
    #states(state) {
        return Object.assign({...this.getState(state)}, state);
    }

    /**
     * Create event
     * @param  {string}   eventName
     * @param  {callable} cb
     * @return {callable}
     */
    #eventHandler(eventName, cb) {
        const inst = this, handler = function(event) {
            if(typeof event !== "object") event = {};
            event.details = inst.#states((event.state ?? {}));
            return cb(event);
        }
        
        if(this.#config.module && typeof window === "object") {
            window.addEventListener(eventName, handler)
            this.#unbind[eventName] = () => window.removeEventListener(eventName, handler)
        }
        return handler;
    }
}
