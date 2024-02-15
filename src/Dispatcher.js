import { StateHandler } from "./StateHandler.js";
import { Router } from "./Router.js";

/**
 * Startox FastRoute and dispatcher
 * Is an 
 */
export class Dispatcher {

    //#handlerEvent = 'dispatched'; // The router event listner name
    //#currentRoute;

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

    serverParams(key) {
        if(typeof key === "string") {
            const inst = this;
            return function() {
                return inst.#handler.getState().server[key];
            }
        }
        return this.#handler.getState().server;
    }

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
        //this.#distpatchPost();
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

        /*
        inst.state(function(updatedRoute) {
            console.log("EHHH:", updatedRoute);
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
         */
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

        //console.log(routeCollection, method, dipatch)
        const inst = this;
        const router = routeCollection.getRouters();
        const uri = dipatch.split("/");
        let httpStatus = 404;
        


        for(let i = 0; i < router.length; i++) {

            const extractRouterData = inst.#escapeForwardSlash(router[i].pattern);
            const routerData = extractRouterData.pattern.split("/");


            let regexItems = Array(), vars = Array();

            for(let x = 0; x < routerData.length; x++) {
                const regex = inst.#getMatchPattern(routerData[x]);
                const value = regex[1] ? regex[2] : routerData[x];
                regexItems.push(value);


                const key = (regex[1] ?? x);

                vars.push({
                    [key]: regex[2]
                });


                /*
                let A = Array(), B = "";
                for(let x = 0; x < uri.length; x++) {

                    A.push(uri[x]);

                    let test = A.join("/").match(value);
                    if(test){
                        A = Array();
                        console.log(key, test[0]);
                        delete routerData[x];
                        
                    }
                }
                 */
           
                

                
            }










            const routerRegex = regexItems.join("/");
            const validateRouter = dipatch.match(routerRegex);


            for(let i = 0; i < vars.length; i++) {





            }


            console.log(vars, routerRegex, validateRouter);
            // PATH = validateRouter[0]




            

        }



        for(let i = 0; i < router.length; i++) {
            let hasEqualMatch, hasMatch, validVars = Array(), vars = {};
            const extractRouterData = inst.#escapeForwardSlash(router[i].pattern);
            const routerData = extractRouterData.pattern.split("/");
            const expectedLength = routerData.length;


            //extractRouterData.length


            
            //let matches = match.match(/\[(.*?)\]/g);



            
            let uriBV = Array(), calcLength = expectedLength;

            if(router[i].verb.includes(method)) {
                for(let x = 0; x < uri.length; x++) {
                    const data = (routerData[x] ?? routerData?.[routerData.length-1]);
                    if(data !== undefined) {
                        const regex = inst.#getMatchPattern(data);
                        const uriB = (regex[2] ?? "").split("/");


                        
                        if(uriB.length > 1) {
                            uriBV = uriBV.concat(uriB)
                        } else {
                            if(uri[x] === regex[2]) uriBV.push(regex[2]);
                        }

                        hasEqualMatch = (uri[x] === uriBV[x]);





                        
                        //console.log(x, uri[x], uriBV[x], hasEqualMatch);
                        

                        

                        if(hasEqualMatch) {
                            validVars.push(uri[x]);

                        } else if(regex[0]) {
                            hasMatch = uri[x].match(regex[0]);
                            hasMatch = (hasMatch && hasMatch[0] && uri.length <= expectedLength);

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

                        }

                        
                        if((!hasEqualMatch && !hasMatch)) {
                            break;
                        }
                       
                    }
                }
            }

            if(hasEqualMatch || hasMatch) {
                //console.log(hasEqualMatch, uri.length, expectedLength);

                return this.#assignResponse({
                    verb: method,
                    status: (uri.length === expectedLength ? 200 : 404),
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
        let count = 0;
        const occ = pattern.replace(/{[^}]+}/g, (match, a) => {

            //let matches = match.match(/\[(.*?)\]/g);

            return match.replace(/\//g, function(x){
                count+=1;
                return "[#SC#]";
            });
        });

        return {
            pattern: occ,
            length: count
        }
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
