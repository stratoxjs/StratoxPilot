import { StateHandler } from "./StateHandler.js";
import { Router } from "./Router.js";

/**
 * Startox FastRoute and dispatcher
 * Is an 
 */
export class Dispatcher {

    #handler;
    #state = {};
    #router;
    #configs = {};

    constructor(configs = {}) {
        const inst = this;
        this.#configs = Object.assign(configs, {
            enablePostRequest: true,
            server: {}
        });

        this.#handler = this.initStateHandler(this.#configs.server);
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
        });
    }

    navigateTo(path, request = {}) {
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
     * Get serverParams as dynamic variable
     * @param  {string} key
     * @return {callable|object}
     */
    serverParams(key) {
        if(typeof key === "string") {
            const inst = this;
            return function() {
                return inst.#handler.getState().server[key];
            }
        }
        return this.#handler.getState().server;
    }

    /**
     * Get request as dynamic variable
     * @param  {string} key
     * @return {callable|object}
     */
    request(key) {
        if(typeof key === "string") {
            const inst = this;
            return function() {
                return inst.#handler.getState().request[key];
            }
        }
        return this.#handler.getState().request;
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
        this.#handler.pushState(path, state);
    }

    /**
     * Init the Dispatcher
     * @param  {Function} fn callback
     * @return {void}
     */
    dispatcher(routeCollection, path, fn) {
        const inst = this;
        this.#distpatchPost();
        this.#handler.on('popstate', function(event) {
            let uriPath = (typeof path === "function") ? path() : path;
            if(typeof uriPath !== "string") {
                throw new Error("Path iswqwdqwd");
            }
            inst.#state = inst.#assignRequest(event.details);
            const dispatcher = inst.validateDispatch(routeCollection, inst.#state.method, uriPath);
            const response = inst.#assignResponse(dispatcher);
            fn.apply(inst, [response, response.status]);
        });

        this.#handler.emitPopState();
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

        const inst = this;
        const router = routeCollection.getRouters();
        const uri = dipatch.split("/");
        let current = {}, parts = uri, 
        regexItems = Array(), vars = {}, path = Array(), hasError = false, statusError = 404;
        for(let i = 0; i < router.length; i++) {
            
            regexItems = Array();
            vars = {};
            path = Array();
            hasError = false;

            if(router[i].verb.includes(method)) {
                const extractRouterData = inst.#escapeForwardSlash(router[i].pattern);
                const routerData = extractRouterData.split("/");

                for(let x = 0; x < routerData.length; x++) {
                    const regex = inst.#getMatchPattern(routerData[x]);
                    const value = regex[1] ? regex[2] : routerData[x];
                    const key = (regex[1] ?? x);
                    regexItems.push(value);

                    let part;
                    if(part = inst.#validateParts(parts, value)) {
                        // Escaped
                        vars[key] = part;
                        path = path.concat(part);
                        parts = parts.slice(part.length);

                    } else {
                        hasError = true;
                        break;
                    }
                }
                if(!hasError) {
                    current = router[i];
                    break;
                }
            } else {
                statusError = 405;
            }

            //const routerRegex = regexItems.join("/");
            //const validateRouter = dipatch.match(routerRegex);
        }

        return {
            verb: method,
            status: (!hasError && (uri.length === path.length) ? 200 : statusError),
            controller: (current?.controller ?? null),
            path: path,
            vars: vars,
            request: {
                get: this.#state?.request?.get,
                post: this.#state?.request?.post
            }
        };
    }

     /**
     * Create a state handler instance 
     * @param  {object} serverParams expects an dynamic object that can act as an server parameter
     * @return {StateHandler}
     */
    initStateHandler(serverParams) {
        if(typeof serverParams !== "object") {
            throw new Error("The argumnet 1 (serverParams) expects an dynamic object that can act as an server parameter.");
        }

        return new StateHandler(function() {
            const location = (window?.location ?? {});
            return {
                method: "GET",
                server: Object.assign(serverParams, {
                    host: (location.href ?? ""),
                    fragment: ((typeof location.hash === "string") ? location.hash.substring(1) : ""),
                    path: (location.pathname ?? ""),
                    query: (location.search ?? "")
                }),
                request: {
                    get: {},
                    post: {}
                }
            }
        });
    }

    /**
     * This will validate each part
     * @param  {array} uri      Uri path as array items
     * @param  {string} value   Pattern value to validate part againts
     * @return {array|false}    Will return each valid part as array items
     */
    #validateParts(uri, value) {
        let uriParts = Array();
        for(let x = 0; x < uri.length; x++) {
            uriParts.push(uri[x]);
            const regex = new RegExp('^'+value+'$');
            const join = uriParts.join("/");
            if(join.match(regex)) {
                return uriParts;
            }
        }
        return false;
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
            const patternValue = this.#unescapeForwardSlash(extractPattern[extractPattern.length-1]);
            const regex = new RegExp('^'+patternValue+'$');
            return [regex, ((extractPattern.length > 1) ? extractPattern[0] : ""), patternValue]
        }
        return [];
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
        return Object.assign({
            method: "GET",
            request: {
                get: {},
                post: {}
            }
        }, state)
    }
}