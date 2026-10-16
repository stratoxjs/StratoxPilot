/**
 * Stratox Route collection
 * Author: Daniel Ronkainen
 * Apache License Version 2.0
 */

/** A request method the router accepts. */
export type HttpVerb = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** An error status the dispatcher gives, and that error() takes. */
export type ErrorStatus = 404 | 405;

/** Your own settings for a route; the dispatcher passes them on as response.config. */
export type RouteConfig = Record<string, unknown>;

/** A registered route, as getRouters() returns it. */
export interface Route<Controller = unknown> {
  verb: HttpVerb[];
  pattern: string;
  controller: Controller;
  config: RouteConfig;
}

/** A controller set with notFound() or error(). */
export interface ErrorRoute<Controller = unknown> {
  status: ErrorStatus;
  controller: Controller;
  config: RouteConfig;
}

export default class Router<Controller = unknown> {
  static #validVerb: HttpVerb[] = ['GET', 'POST', 'PUT', 'DELETE']; // Allowed verbs

  static #errorStatuses: ErrorStatus[] = [404, 405]; // The error statuses the dispatcher gives

  #router: Route<Controller>[] = [];

  // { status: { status, controller, config } } from notFound() and error(); not routes, so kept apart (D-050)
  #errorControllers: Record<number, ErrorRoute<Controller>> = {};

  /**
   * Return the router data
   * @return The registered routes, in the order they were added
   */
  getRouters(): Route<Controller>[] {
    return this.#router;
  }

  /**
   * Add router
   * @param  verbArg     GET, POST, PUT or DELETE, in any case; or a list of them
   * @param  pattern     Preg match pattern
   * @param  controller  Whatever you want the router to execute
   * @param  config      Passed on as response.config
   */
  map(verbArg: string | string[], pattern: string, controller: Controller, config?: RouteConfig): void {
    let verb = verbArg;
    if (typeof verb === 'string') {
      verb = Array(verb);
    }
    // Checked at runtime too, for callers without types
    if (!Array.isArray(verb)) {
      throw new Error('Argument 1 (verb) needs to be string or array.');
    }
    if (typeof pattern !== 'string') {
      throw new Error('Argument 2 (pattern) needs to be a string.');
    }

    const verbs = Router.validateVerb(verb);
    const takenVerbs = this.#takenVerbs(pattern, verbs);
    if (takenVerbs.length > 0) {
      throw new Error(`Argument 2 (pattern: ${pattern}) already exists for ${takenVerbs.join(', ')}.`);
    }
    this.#router.push({
      verb: verbs,
      pattern,
      controller,
      config: (config ?? {}),
    });
  }

  /**
   * The verbs an earlier route already serves for this pattern. Under the first-match rule (D-048)
   * a second route for them could never be reached (audit F1, D-051). [STATUS_ERROR] is not a path:
   * it may be registered again, and the last one wins, like error() (D-050).
   * @param  pattern
   * @param  verbs   Upper-cased
   */
  #takenVerbs(pattern: string, verbs: HttpVerb[]): HttpVerb[] {
    if (pattern === '[STATUS_ERROR]') {
      return [];
    }
    const sameRoutes = this.#router.filter((route) => route.pattern === pattern);
    return verbs.filter((verb) => sameRoutes.some((route) => route.verb.includes(verb)));
  }

  /**
   * Add GET router
   * @param  pattern     Preg match pattern
   * @param  controller  Whatever you want the router to execute
   * @param  config      Passed on as response.config
   */
  get(pattern: string, controller: Controller, config?: RouteConfig): void {
    this.map('GET', pattern, controller, config);
  }

  /**
   * Add POST router
   * @param  pattern     Preg match pattern
   * @param  controller  Whatever you want the router to execute
   * @param  config      Passed on as response.config
   */
  post(pattern: string, controller: Controller, config?: RouteConfig): void {
    this.map('POST', pattern, controller, config);
  }

  /**
   * Add PUT router
   * @param  pattern     Preg match pattern
   * @param  controller  Whatever you want the router to execute
   * @param  config      Passed on as response.config
   */
  put(pattern: string, controller: Controller, config?: RouteConfig): void {
    this.map('PUT', pattern, controller, config);
  }

  /**
   * Add DELETE router
   * @param  pattern     Preg match pattern
   * @param  controller  Whatever you want the router to execute
   * @param  config      Passed on as response.config
   */
  delete(pattern: string, controller: Controller, config?: RouteConfig): void {
    this.map('DELETE', pattern, controller, config);
  }

  /**
   * Set the controller for 404 Not Found, for every request method
   * @param  controller  Whatever you want the router to execute
   * @param  config      Passed on as response.config
   */
  notFound(controller: Controller, config?: RouteConfig): void {
    this.error(404, controller, config);
  }

  /**
   * Set the controller for one error status, for every request method.
   * Registering a status again replaces its controller.
   * @param  status      404 or 405
   * @param  controller  Whatever you want the router to execute
   * @param  config      Passed on as response.config
   */
  error(status: ErrorStatus, controller: Controller, config?: RouteConfig): void {
    // Checked at runtime too, for callers without types
    if (!Router.#errorStatuses.includes(status)) {
      throw new Error(`Argument 1 (status) needs to be ${Router.#errorStatuses.join(' or ')}, got ${JSON.stringify(status)}.`);
    }
    this.#errorControllers[status] = { status, controller, config: (config ?? {}) };
  }

  /**
   * Get the error controller for a status, wherever it was registered
   * @param  status
   * @return False for status 200 or when there is no error route
   */
  getStatusError(status: number): Controller | false {
    const errorRoute = this.getStatusErrorRoute(status);
    if (errorRoute === false) {
      return false;
    }
    // A route whose controller is null or undefined gives false too
    return errorRoute.controller ?? false;
  }

  /**
   * Get the error route for a status: the one from notFound() or error() for that status
   * ({ status, controller, config }), else the [STATUS_ERROR] route (verb, pattern, controller, config)
   * @param  status
   * @return False for status 200 or when there is no error route
   */
  getStatusErrorRoute(status: number): ErrorRoute<Controller> | Route<Controller> | false {
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
   * @return { pattern: controller } for each POST route, or false when there is none
   */
  hasPostRoutes(): Record<string, Controller> | false {
    const postRoutes = this.#router.filter((route) => route.verb.includes('POST'));
    if (postRoutes.length === 0) {
      return false;
    }
    return Object.fromEntries(postRoutes.map((route) => [route.pattern, route.controller]));
  }

  /**
   * Get all valid verbs
   * @return A copy, so changing it does not change which verbs are valid
   */
  static getValidVerbs(): HttpVerb[] {
    return [...this.#validVerb];
  }

  /**
   * Check if verb is supported
   * @param  verb  Method to test for, upper-case
   */
  static isValidVerb(verb: string): verb is HttpVerb {
    return this.#validVerb.some((validVerb) => validVerb === verb);
  }

  /**
   * Upper-case and check a list of verbs; the list passed in is not changed
   * @param  verbArg  Collection of methods, an error is thrown for one that is not supported
   * @return A new array with the upper-cased verbs
   */
  static validateVerb(verbArg: string[]): HttpVerb[] {
    const verbs = verbArg.map((verb) => verb.toUpperCase());
    return verbs.map((verb) => {
      if (!Router.isValidVerb(verb)) {
        throw new Error(`The verb (http method) "${verb}" is not allowed. Supported verbs: ${Router.#validVerb.join(', ')}`);
      }
      return verb;
    });
  }
}
