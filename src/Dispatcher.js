import { Router } from "./Router.js";

/**
 * Startox FastRoute and dispatcher
 * Is an 
 */
export class Dispatcher {

    #handlerEvent = 'dispatched'; // The router event listner name
    #currentRoute;
    #state = {};
    #router;
    #configs = {};

    constructor(configs = {}) {
        this.#configs = Object.assign(configs, {
            enablePostRequest: true,
        });

        this.unbind = this.#eventHandler('popstate', this.#requestDispatch.bind(this));
        this.#currentRoute = this.#updateEventState();
    }
    
    /**
     * Push post state
     * @param  {string} path     URI path or hash
     * @param  {Object} request  Add get query param data 
     * @return {Object} request object
     */
    navTo(path, request = {}) {
        this.pushState(path, {
            method: "GET",
            request: {
                get: request,
                post: {}
            },
        });
        return request;
    }

    /**
     * Push post state
     * @param  {string} path     URI path or hash
     * @param  {Object} request  Add post form data 
     * @return {Object} Instance of formData
     */
    postTo(path, request = {}) {

        let formData = request;
        if(!(request instanceof FormData)) {
            formData = this.objToFormData(request);
        }

        this.pushState(path, {
            method: "POST",
            request: {
                get: {},
                post: formData
            },
        });
        return formData;
    }

    /**
     * Push state
     * @param  {string} path  URI
     * @param  {Object} state {method: GET|POST, request: {...More data} }
     * @return {void}
     */
    pushState(path, state = {}) {
        state = this.#assignRequest(state);
        state.method = state.method.toUpperCase();
        if(!Router.isValidVerb(state.method)) {
            throw new Error('The verb (http method) "'+state.method+'" is not allowed. Supported verbs: '+Router.getValidVerbs().join(", "));
        }
        history.pushState(state, '', path)
        this.#requestDispatch();
    }

    /**
     * Update current state
     * @return {void}
     */
    refreshState() {
        this.#requestDispatch();
    }

    /**
     * Object to form data
     * @param  {object} request
     * @return {object} Instance of formData.
     */
    objToFormData(request) {
        const formData = new FormData();
        for(const [key, value] of Object.entries(request)) {
            formData.append(key, value);
        }
        return formData;
    }


    /**
     * This will handle the post method
     * @return {void}
     */
    #distpatchPost() {
        const inst = this;
        if(this.#configs.enablePostRequest) document.addEventListener('submit', function(event) {
            event.preventDefault();
            const form = event.target;
            const formData = new FormData(form);

            inst.postTo(form.action, formData);

            /*
            inst.pushState(form.action, {
                method: "POST",
                request: {
                    post: formData,
                }
            });
             */
        });
    }

    /**
     * Init the Dispatcher
     * @param  {Function} fn callback
     * @return {void}
     */
    dispatcher(routeCollection, fn) {
        const inst = this;
        this.#distpatchPost();
        inst.state(function(updatedRoute) {

            console.log("EHHH:", updatedRoute);
            const requestGet = Object.assign((updatedRoute?.query ?? {}), (updatedRoute?.state?.request.get ?? {}));
            inst.#state = inst.#assignRequest(Object.assign((updatedRoute?.state ?? {}), {
                request: {
                    get: requestGet,
                    post: (updatedRoute?.state?.request?.post ?? {})
                }
            }));
            const dispatcher = inst.validateDispatch(routeCollection, inst.#state.method, updatedRoute.hash);
            const response = inst.#assignResponse(dispatcher);
            fn.apply(inst, [response, response.status]);
        });

        this.dispatch();
    }

    /**
     * Validate dispatch
     * @param  {string} method  Verb (GET, POST)
     * @param  {uri} dipatch    The uri/hash to validate
     * @return {object|false}
     */
    validateDispatch(routeCollection, method, dipatch) {

        if(!(routeCollection instanceof Router)) {
            throw new Error("The first function argumnets is expected to be an instance of Startox Router class.");
        }

        console.log(routeCollection, method, dipatch)
        const inst = this;
        const router = routeCollection.getRouters();
        const uri = dipatch.split("/");
        let httpStatus = 404;
        
        for(let i = 0; i < router.length; i++) {
            let hasEqualMatch, hasMatch, validVars = Array(), vars = {};
            const routerData = inst.#escapeForwardSlash(router[i].pattern).split("/");

            if(router[i].verb.includes(method)) {
                for(let x = 0; x < uri.length; x++) {
                    const data = (routerData[x] ?? routerData?.[routerData.length-1]);
                    if(data !== undefined) {
                        const regex = inst.#getMatchPattern(data);
                        hasEqualMatch = (uri[x] === data);

                        if(regex[0]) {
                            hasMatch = uri[x].match(regex[0]);
                            hasMatch = (hasMatch && hasMatch[0] && uri.length >= routerData.length);

                            if(hasMatch) {
                                if(regex[1]) {
                                    if(vars[regex[1]]) {
                                        vars[regex[1]].push(uri[x]);
                                    } else {
                                        vars[regex[1]] = [uri[x]];
                                    }
                                }
                                validVars.push(uri[x]);
                            }

                            // Will delete data, so it wont "re-validate" for nested slashes inside pattern like [^/]
                            if(regex[2] !== '.+') {
                                delete routerData[x];
                            }

                        } else if(hasEqualMatch) {
                            validVars.push(uri[x]);
                        }

                        if((!hasEqualMatch && !hasMatch)) {
                            break;
                        }
                    }
                }
            }

            if(hasEqualMatch || hasMatch) {
                return this.#assignResponse({
                    verb: method,
                    status: (uri.length === validVars.length ? 200 : 404),
                    controller: router[i].controller,
                    path: validVars,
                    vars: vars,
                    request: {
                        get: this.#state?.request?.get,
                        post: this.#state?.request?.post
                    }
                });
            }            
        }
        return { status: httpStatus };
    }


    /**
     * Trigger dispatch
     * @return {event}
     */
    dispatch() {
        return this.eventEmitter(this.#handlerEvent, { ...this.#currentRoute });
    }

    /**
     * Unbind
     * @return {void}
     */
    unbind() {
        this.unbind();
    }

    /**
     * Escape request (XSS protection)
     * @param  {string} search
     * @return {string}
     */
    parseStr(value) {
        /*
        const params = new URLSearchParams(value).entries();
        for (const [key, value] of params) {
          console.log(`${key}: ${value}`);
        }
         */
        return [...new URLSearchParams(value).entries()].reduce((items, [key, val]) => Object.assign(items, { [key]: val }), {})
    }

    /**
     * Emit the event
     * @param  {string} eventName
     * @param  {spred}  args
     * @return {void}
     */
    eventEmitter(eventName, ...args) {
        const detail = { args }
        const event = new CustomEvent(eventName, { detail })
        window.dispatchEvent(event)
    }

    /**
     * State callback
     * @param  {Function} fn
     * @return {event}
     */
    state(fn) {
        let event = this.#eventHandler(this.#handlerEvent, (currentRoute) => {
            fn({ ...currentRoute })
        });
        return event;
    }

    /**
     * Build and return patterns
     * @param  {string} matchStr
     * @return {array}
     */
    #getMatchPattern(matchStr) {
        const matchPatter = matchStr.match(/{(.*?)}/g);
        if(matchPatter) {
            const patterns = matchPatter.map(item => item.slice(1, -1));
            const extractPattern = patterns[0].split(":");
            const regex = new RegExp('^'+this.#unescapeForwardSlash(extractPattern[extractPattern.length-1])+'$');
            return [regex, ((extractPattern.length > 1) ? extractPattern[0] : ""), extractPattern[extractPattern.length-1]]
        }
        return [];
    }

    /**
     * Prepare the dispatch
     * @param  {object} event
     * @return {void}
     */
    #requestDispatch(event) {
        this.#currentRoute = this.#updateEventState(event)
        this.eventEmitter(this.#handlerEvent, { ...this.#currentRoute })
    }

    /**
     * Get the event state
     * @param  {object} event listner event
     * @return {object}
     */
    #updateEventState(event) {
        return {
            state: event?.state ?? history.state,
            href: location.href,
            path: location.pathname,
            query: this.parseStr(location.search),
            hash: location.hash.substring(1),
        }
    }

    /**
     * Router change event listner
     * @param  {string}   eventName Event name
     * @param  {Function} cb
     */
    #eventHandler(eventName, cb) {
        const handler = (event) => cb(...(event?.detail?.args ?? []))
        window.addEventListener(eventName, handler)
        return () => window.removeEventListener(eventName, handler)
    }

    /**
     * Escape forward slash
     * @param  {string} pattern
     * @return {string}
     */
    #escapeForwardSlash(pattern) {
        return pattern.replace(/{[^}]+}/g, (match, a) => {
            return match.replace(/\//g, "[#SC#]");
        });
    }

    /**
     * Unescape forward slash
     * @param  {string} pattern
     * @return {string}
     */
    #unescapeForwardSlash(pattern) {
        return pattern.replace(/\[#SC#\]/g, "/");
    }

    /**
     * Assign response
     * @param  {object} response
     * @return {object}
     */
    #assignResponse(response) {
        return Object.assign({
            verb: "GET",
            status: 404,
            controller: null,
            path: Array(),
            vars: {},
            request: {
                get: {},
                post: {}
            }
        }, response);
    }

    /**
     * Assign request
     * @param  {object} state
     * @return {object}
     */
    #assignRequest(state) {
        return state = Object.assign({
            method: "GET",
            request: {
                get: {},
                post: {}
            }
        }, state)
    }
}
