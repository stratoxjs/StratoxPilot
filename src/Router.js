/**
 * Stratox Route collection
 * Author: Daniel Ronkainen
 * Apache License Version 2.0
 */
export default class Router {
  static #validVerb = ['GET', 'POST', 'PUT', 'DELETE']; // Allowed verbs

  #router = [];

  #protocol = {};

  /**
     * Return the router data
     * @return {array}
     */
  getRouters() {
    return this.#router;
  }

  /**
     * Add router
     * @param  {string} verbArg     GET, POST
     * @param  {string} pattern     Preg match pattern
     * @param  {mixed} controller   Whatever you want the router to execute
     * @return {void}
     */
  map(verbArg, pattern, controller, config) {
    let verb = verbArg;
    if (typeof verb === 'string') {
      verb = Array(verb);
    }
    if (!Array.isArray(verb)) {
      throw new Error('Argument 1 (verb) needs to be string or array.');
    }
    if (typeof pattern !== 'string') {
      throw new Error('Argument 2 (pattern) needs to be a string.');
    }
    if (typeof this.#protocol?.[verb]?.[pattern] === 'string') {
      throw new Error(`Argument 2 (pattern: ${pattern}) already exists.`);
    }

    this.#router.push({
      verb: Router.validateVerb(verb),
      pattern,
      controller,
      config: (config ?? {}),
    });
    this.#protocol[verb] = { [pattern]: controller };
  }

  /**
     * Add GET router
     * @param  {string} pattern     Preg match pattern
     * @param  {mixed} controller   Whatever you want the router to execute
     * @return {void}
     */
  get(pattern, controller, config) {
    this.map('GET', pattern, controller, config);
  }

  /**
     * Add POST router
     * @param  {string} pattern     Preg match pattern
     * @param  {mixed} controller   Whatever you want the router to execute
     * @return {void}
     */
  post(pattern, controller, config) {
    this.map('POST', pattern, controller, config);
  }

  /**
     * Add PUT router
     * @param  {string} pattern     Preg match pattern
     * @param  {mixed} controller   Whatever you want the router to execute
     * @return {void}
     */
  put(pattern, controller, config) {
    this.map('PUT', pattern, controller, config);
  }

  /**
     * Add DELETE router
     * @param  {string} pattern     Preg match pattern
     * @param  {mixed} controller   Whatever you want the router to execute
     * @return {void}
     */
  delete(pattern, controller, config) {
    this.map('DELETE', pattern, controller, config);
  }

  /**
     * Get the controller of the [STATUS_ERROR] route, wherever it was registered
     * @param  {int} status
     * @return {mixed|false} False for status 200 or when there is no error route
     */
  getStatusError(status) {
    if (status === 200) {
      return false;
    }
    const errorRoute = this.#router.findLast((route) => (
      route.pattern === '[STATUS_ERROR]' && route.verb.includes('GET')
    ));
    return errorRoute?.controller ?? false;
  }

  /**
     * Get every route that accepts POST
     * @return {object|false} { pattern: controller } for each POST route, or false when there is none
     */
  hasPostRoutes() {
    const postRoutes = this.#router.filter((route) => route.verb.includes('POST'));
    if (postRoutes.length === 0) {
      return false;
    }
    return Object.fromEntries(postRoutes.map((route) => [route.pattern, route.controller]));
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
     * @param  {array} verbArg Collection of valid methods, else a error will be thrown
     * @return {array}
     */
  static validateVerb(verbArg) {
    const verb = verbArg;
    const inst = this;
    for (let i = 0; i < verb.length; i++) {
      verb[i] = verb[i].toUpperCase();
      if (!Router.isValidVerb(verb[i])) {
        throw new Error(`The verb (http method) "${verb[i]}" is not allowed. Supported verbs: ${inst.#validVerb.join(', ')}`);
      }
    }
    return verb;
  }
}
