/**
 * Startox FastRoute and dispatcher
 * Is an 
 */
export class Router {

    static #validVerb = ["GET", "POST"]; // Allowed verbs
    #router = Array();

    constructor() {
    }

    /**
     * Return the router data
     * @return {array}
     */
    getRouters() {
        return this.#router;
    }

    /**
     * Add router
     * @param  {string} verb        GET, POST
     * @param  {string} pattern     Preg match pattern
     * @param  {mixed} controller   Whatever you want the router to execute
     * @return {void}
     */
    map(verb, pattern, controller) {
        if(typeof verb === "string") {
            verb = Array(verb);
        }
        if(!Array.isArray(verb)) {
            throw new Error('Argumnent 1 (verb) needs to be string or array.');
        }
        if(typeof pattern !== "string") {
            throw new Error('Argumnent 2 (pattern) needs to be a string.');
        }
        this.#router.push({
            verb: Router.validateVerb(verb),
            pattern: pattern,
            controller: controller
        });
    }

    /**
     * Add GET router
     * @param  {string} pattern     Preg match pattern
     * @param  {mixed} controller   Whatever you want the router to execute
     * @return {void}
     */
    get(pattern, controller) {
        this.map("GET", pattern, controller);
    }

    /**
     * Add POST router
     * @param  {string} pattern     Preg match pattern
     * @param  {mixed} controller   Whatever you want the router to execute
     * @return {void}
     */
    post(pattern, controller) {
        this.map("POST", pattern, controller);
    }

    /**
     * Get all valid verbs
     * @return {array}
     */
    static getValidVerbs() {
        return this.#validVerb;
    }

    /**
     * Check if verb is supported
     * @param  {string}  verb Method to test for
     * @return {Boolean}
     */
    static isValidVerb(verb) {
        return this.#validVerb.includes(verb);
    }

    /**
     * Returned valid verb
     * @param  {array} verb Collection of valid methods, else a error will be thrown
     * @return {array}
     */
    static validateVerb(verb) {
        const inst = this;
        for(let i = 0; i < verb.length; i++) {
            verb[i] = verb[i].toUpperCase();
            if(!Router.isValidVerb(verb[i])) {
                throw new Error('The verb (http method) "'+verb[i]+'" is not allowed. Supported verbs: '+inst.#validVerb.join(", "));
            }
        }
        return verb;
    }
}
