/**
 * Stratox Route collection
 * Author: Daniel Ronkainen
 * Apache License Version 2.0
 */
export default class Router {
  static #validVerb = ['GET', 'POST', 'PUT', 'DELETE']; // Allowed verbs

  static #errorStatuses = [404, 405]; // The error statuses the dispatcher gives

  #router = [];

  // { status: { status, controller, config } } from notFound() and error(); not routes, so kept apart (D-050)
  #errorControllers = {};

  // Backs only the duplicate-pattern check: the latest { pattern: controller } for each list of verbs.
  // The check is narrow on purpose until the next major (audit F1, pilot Group C).
  #latestPatternByVerbs = {};

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
    // Checked before the verbs are upper-cased, so "get" is not compared with "GET"
    if (typeof this.#latestPatternByVerbs[verb]?.[pattern] === 'string') {
      throw new Error(`Argument 2 (pattern: ${pattern}) already exists.`);
    }

    const verbs = Router.validateVerb(verb);
    this.#router.push({
      verb: verbs,
      pattern,
      controller,
      config: (config ?? {}),
    });
    this.#latestPatternByVerbs[verbs] = { [pattern]: controller };
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
     * Set the controller for 404 Not Found, for every request method
     * @param  {mixed} controller   Whatever you want the router to execute
     * @param  {object} config
     * @return {void}
     */
  notFound(controller, config) {
    this.error(404, controller, config);
  }

  /**
     * Set the controller for one error status, for every request method.
     * Registering a status again replaces its controller.
     * @param  {int} status         404 or 405
     * @param  {mixed} controller   Whatever you want the router to execute
     * @param  {object} config
     * @return {void}
     */
  error(status, controller, config) {
    if (!Router.#errorStatuses.includes(status)) {
      throw new Error(`Argument 1 (status) needs to be ${Router.#errorStatuses.join(' or ')}, got ${JSON.stringify(status)}.`);
    }
    this.#errorControllers[status] = { status, controller, config: (config ?? {}) };
  }

  /**
     * Get the error controller for a status, wherever it was registered
     * @param  {int} status
     * @return {mixed|false} False for status 200 or when there is no error route
     */
  getStatusError(status) {
    return this.getStatusErrorRoute(status)?.controller ?? false;
  }

  /**
     * Get the error route for a status: the one from notFound() or error() for that status
     * ({ status, controller, config }), else the [STATUS_ERROR] route (verb, pattern, controller, config)
     * @param  {int} status
     * @return {object|false} False for status 200 or when there is no error route
     */
  getStatusErrorRoute(status) {
    if (status === 200) {
      return false;
    }
    if (this.#errorControllers[status]) {
      return this.#errorControllers[status];
    }
    // [STATUS_ERROR] stays as the alias for every error status without its own controller (D-050)
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
     * @return {array} A copy, so changing it does not change which verbs are valid
     */
  static getValidVerbs() {
    return [...this.#validVerb];
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
