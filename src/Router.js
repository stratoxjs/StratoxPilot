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

    const verbs = Router.validateVerb(verb);
    this.#router.push({
      verb: verbs,
      pattern,
      controller,
      config: (config ?? {}),
    });
    this.#protocol[verbs] = { [pattern]: controller };
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
    return this.getStatusErrorRoute(status)?.controller ?? false;
  }

  /**
     * Get the [STATUS_ERROR] route itself (verb, pattern, controller, config)
     * @param  {int} status
     * @return {object|false} False for status 200 or when there is no error route
     */
  getStatusErrorRoute(status) {
    if (status === 200) {
      return false;
    }
    const errorRoute = this.#router.findLast((route) => (
      route.pattern === '[STATUS_ERROR]' && route.verb.includes('GET')
    ));
    return errorRoute ?? false;
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
     * Upper-case and check a list of verbs; the list passed in is not changed
     * @param  {array} verbArg Collection of methods, an error is thrown for one that is not supported
     * @return {array} A new array with the upper-cased verbs
     */
  static validateVerb(verbArg) {
    const verbs = verbArg.map((verb) => verb.toUpperCase());
    verbs.forEach((verb) => {
      if (!Router.isValidVerb(verb)) {
        throw new Error(`The verb (http method) "${verb}" is not allowed. Supported verbs: ${Router.#validVerb.join(', ')}`);
      }
    });
    return verbs;
  }
}
