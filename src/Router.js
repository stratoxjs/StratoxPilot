/**
 * Stratox Route collection
 * Author: Daniel Ronkainen
 * Apache License Version 2.0
 */
export class Router {
  static #validVerb = ['GET', 'POST', 'PUT', 'DELETE']; // Allowed verbs

  #router = Array();

  #protocol = {};

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
  map(verb, pattern, controller, config) {
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
     * Get status error router IF specified
     * @param  {int} status
     * @return {mixed|false}
     */
  getStatusError(status) {
    if (status !== 200) {
      return (this.#protocol?.GET?.['[STATUS_ERROR]'] ?? false);
    }
    return false;
  }

  /**
     * Check if any post routes exists
     * @return {Boolean}
     */
  hasPostRoutes() {
    return (this.#protocol?.POST ?? false);
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
    for (let i = 0; i < verb.length; i++) {
      verb[i] = verb[i].toUpperCase();
      if (!Router.isValidVerb(verb[i])) {
        throw new Error(`The verb (http method) "${verb[i]}" is not allowed. Supported verbs: ${inst.#validVerb.join(', ')}`);
      }
    }
    return verb;
  }
}
