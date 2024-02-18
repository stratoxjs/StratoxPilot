

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

    on(eventName, handler) {
        if(!this.#handlers[eventName]) this.#handlers[eventName] = [];
        const hand = this.#eventHandler(eventName, handler.bind(this));
        this.#handlers[eventName].push(hand);    
    }

    off(eventName) {
        if(typeof this.#unbind[eventName] === "function") {
            this.#unbind[eventName]();
            return true;
        }
        return false;
    }

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

    emit(eventName, data) {
        if(typeof this.#handlers[eventName] !== "object") {
            throw new Error("Trying to emit to an event ("+eventName+") does not yet exists.");
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

    #states(state) {
        return Object.assign({...this.getState(state)}, state);
    }

    getState(state) {
        if(typeof this.#state === "function" || this.#state === "object") {
            return this.#state(state);
        }
        return (typeof this.#state === "object") ? this.#state : {};
    }
    
}
