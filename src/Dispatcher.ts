import StateHandler from './StateHandler.js';
import type { StateEvent } from './StateHandler.js';
import Router from './Router.js';
import type { HttpVerb, Route, RouteConfig } from './Router.js';

/** A value, or a function that returns it each time it is needed (serverParams(key) gives one). */
export type Dynamic<T> = T | (() => T);

/** Options for a Dispatcher. */
export interface DispatcherConfig {
  /** Catch same-origin form submits and dispatch them (default false). */
  catchForms?: boolean;
  /** Catch same-origin link clicks and dispatch them (default false, D-047). */
  catchLinks?: boolean;
  /** Prefix of the hash fragment, such as "!" for "#!about" (default ''). */
  fragmentPrefix?: string;
  /** Extra server parameters, merged into serverParams() (default {}). */
  server?: Dynamic<Record<string, unknown>>;
  /** A directory the app lives in, such as "/app" (default ''). */
  root?: string;
}

/**
 * A Router, or its routes as an array. `getRouters?: undefined` on the array lets TypeScript
 * tell the two apart by the same check getRouterData() makes.
 */
export type RouteCollection<Controller = unknown> =
  | Router<Controller>
  | (Route<Controller>[] & { getRouters?: undefined });

/** The fields of a request: the GET query or the posted data. */
export type RequestFields = Record<string, unknown>;

/** What the browser location gives, plus the `server` config; serverParams() returns it. */
export interface ServerParams {
  host: string;
  hash: string;
  fragment: string;
  path: string;
  auto: string;
  query: Record<string, string>;
  [key: string]: unknown;
}

/** The state that pushState() takes and the dispatcher reads back on every popstate. */
export interface RequestState {
  method: string;
  request: {
    /** The path that is matched; `{}` until one is set */
    path?: string | object;
    /** The GET fields; a URLSearchParams once the dispatcher has read them */
    get?: unknown;
    post?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** The status a dispatch gives. */
export type DispatchStatus = 200 | 404 | 405;

/** What validateDispatch() finds for a method and a path. */
export interface MatchResult<Controller = unknown> {
  verb: string;
  status: DispatchStatus;
  controller: Controller | null;
  config: RouteConfig | null;
  path: string[];
  vars: Record<string, string[]>;
  params: Record<string, string>;
  /** Undefined before the first dispatch */
  request: {
    get: URLSearchParams | undefined;
    post: unknown;
  };
}

/** What the dispatcher() callback gets. */
export interface DispatchResponse<Controller = unknown> extends MatchResult<Controller> {
  /** The form a catchForms submit came from, else null */
  form: HTMLFormElement | null;
  /** True for the browser's Back and Forward (audit F30) */
  fromHistory: boolean;
}

/** The dispatcher() callback; `this` is the Dispatcher. */
export type DispatchCallback<Controller = unknown> =
  (this: Dispatcher, response: DispatchResponse<Controller>, status: DispatchStatus) => void;

/** A route pattern segment, compiled once. */
interface Segment {
  isPattern: boolean;
  name: string | undefined;
  value: string;
  /** Undefined for a literal; null for a pattern that is not a valid regular expression */
  regex: RegExp | null | undefined;
  isRequired: boolean;
}

/** The first {name:pattern} or {pattern} in a route segment; a literal segment has none. */
type MatchPattern =
  | { isPattern: true; name: string; value: string }
  | { isPattern: false; name?: undefined; value?: undefined };

/** What URLSearchParams takes, as the DOM types list it. */
type QueryInit = string | string[][] | Record<string, string> | URLSearchParams;

/**
 * Stratox Dispatcher
 * Author: Daniel Ronkainen
 * Apache License Version 2.0
 */
export default class Dispatcher {
  #handler: StateHandler;

  // {} until the first dispatch
  #state: RequestState | Record<string, never> = {};

  // Set in full by the constructor
  #configs = {} as Required<DispatcherConfig>;

  #form: HTMLFormElement | null = null;

  // Route patterns split into segments with their regular expressions, built once per pattern
  #compiledPatterns: Map<string, Segment[]> = new Map();

  #specCharMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  constructor(configs: DispatcherConfig = {}) {
    this.#configs = {
      catchForms: false, // Auto catch forms
      catchLinks: false, // Auto catch same-origin link clicks (D-047)
      fragmentPrefix: '', // Prefix hash fragment
      server: {},
      root: '',
      ...configs,
    };

    this.#handler = this.initStateHandler(this.#configs.server);
  }

  /**
   * Navigate to a new page
   * @param  path    A uri path or anchor with path e.g. #page1/page2/page3
   * @param  request GET request
   * @return The GET fields
   */
  navigateTo(path: string | URL, request: RequestFields = {}): unknown {
    return this.mapTo('GET', path, request);
  }

  // Same as method "navigateTo"
  pushToState(path: string | URL, request: RequestFields = {}): unknown {
    return this.mapTo('GET', path, request);
  }

  /**
   * Push post state
   * @param  path     URI path or hash
   * @param  request  Add post form data
   * @return The post data it was given
   */
  postTo(path: string | URL, request: RequestFields | FormData = {}): RequestFields | FormData {
    this.mapTo('POST', path, false, request);
    return request;
  }

  /**
   * Push put state
   * @param  path     URI path or hash
   * @param  request  Add post form data
   * @return The post data it was given
   */
  putTo(path: string | URL, request: RequestFields | FormData = {}): RequestFields | FormData {
    this.mapTo('PUT', path, false, request);
    return request;
  }

  /**
   * Push delete state
   * @param  path    A uri path or anchor with path e.g. #page1/page2/page3
   * @param  request GET request
   * @return The GET fields
   */
  deleteTo(path: string | URL, request: RequestFields = {}): unknown {
    return this.mapTo('DELETE', path, request);
  }

  /**
   * Push post state
   * @param  verb         GET, POST, PUT, DELETE
   * @param  path         URI path or hash
   * @param  requestGet   GET fields, or false for none
   * @param  requestPost  Add post form data
   * @return The GET fields
   */
  mapTo(verb: string, path: string | URL, requestGet: RequestFields | false = {}, requestPost: RequestFields | FormData = {}): unknown {
    let formData = requestPost;
    const data = this.buildGetPath(path, requestGet);

    if (!(requestPost instanceof FormData)) {
      // formData = this.objToFormData(requestPost);
      // Clonable bug in webkit
      formData = requestPost;
    }

    this.pushState(data.path, {
      method: verb,
      request: {
        path: data.pathname,
        get: data.query,
        post: formData,
      },
    });
    return (verb ? (data.query ?? requestGet) : formData);
  }

  /**
   * Get serverParams as dynamic variable
   * @param  key  Get param, if not specified then get all
   * @param  obj  Add object that you want to merge current param with (KEY is required)
   * @return A function that reads the param when called, or all params
   */
  serverParams(): ServerParams;
  serverParams(key: string, obj?: object): () => unknown;
  serverParams(key?: string, obj?: object): ServerParams | (() => unknown) {
    if (typeof key === 'string') {
      return () => this.#valueOrMerged((this.#handler.getState().server as ServerParams)[key], obj);
    }
    return this.#handler.getState().server as ServerParams;
  }

  /**
   * Get request as dynamic variable
   * @param  key  Get param, if not specified then get all
   * @param  obj  Add object that you want to merge current param with (KEY is required)
   * @return A function that reads the param when called, or the whole request (undefined before the first dispatch)
   */
  request(): RequestState['request'] | undefined;
  request(key: string, obj?: object): () => unknown;
  request(key?: string, obj?: object): RequestState['request'] | undefined | (() => unknown) {
    if (typeof key === 'string') {
      return () => this.#valueOrMerged((this.#state.request?.[key] ?? '/'), obj);
    }
    return this.#state.request;
  }

  /**
   * A string as it is; an object with obj merged into it. Object.assign on a string would
   * return a String object, which is not === to a string (audit F10, D-049).
   * Anything else is passed to Object.assign as well, which throws for undefined and null.
   * @param  value
   * @param  obj
   */
  #valueOrMerged(value: unknown, obj?: object): unknown {
    return (typeof value === 'string') ? value : Object.assign(value as object, obj);
  }

  /**
   * Push state
   * @param  path      URI
   * @param  stateArg  {method: GET|POST, request: {...More data} }
   */
  pushState(path: string, stateArg: Partial<RequestState> = {}): void {
    const state = this.#assignRequest(stateArg);
    state.method = state.method.toUpperCase();
    // The dispatcher matches state.request.path; without one, use the path being pushed (audit F25)
    if (typeof state.request.path !== 'string') {
      state.request = { ...state.request, path };
    }
    if (!Router.isValidVerb(state.method)) {
      throw new Error(`The verb (http method) "${state.method}" is not allowed. Supported verbs: ${Router.getValidVerbs().join(', ')}`);
    }
    this.#handler.pushState(this.baseDir(path, true), state);
  }

  /**
   * Init the Dispatcher
   * @param  routeCollection  The routes
   * @param  path             The path to match, read on every dispatch: serverParams('path') or serverParams('fragment')
   * @param  fn               Called with the response and its status on every dispatch
   */
  dispatcher<Controller>(routeCollection: Router<Controller>, path: Dynamic<unknown>, fn: DispatchCallback<Controller>): void {
    // if(routeCollection.hasPostRoutes())
    this.#catchFormEvents();
    this.#catchLinkEvents();
    this.#handler.on('popstate', (eventArg) => {
      // The state handler merges the pushed state into the start state, so details holds a request state
      const event = eventArg as StateEvent & { details: RequestState };
      event.details.request.get = this.buildQueryObj(event.details.request.get);
      this.#state = this.#assignRequest(event.details);
      const uriPath = this.baseDir(this.#getDynUri(path).toString());
      const matched = this.validateDispatch(routeCollection, this.#state.method, uriPath);
      // Back and Forward fire the browser's own popstate event; pushState and refresh emit a plain object (audit F30)
      const fromHistory = (typeof PopStateEvent === 'function' && event instanceof PopStateEvent);
      const response = this.#assignResponse({ ...matched, fromHistory });
      fn.apply(this, [response, response.status]);
    });

    this.#handler.emitPopState();
  }

  /**
   * Get the state handler
   */
  getStateHandler(): StateHandler {
    return this.#handler;
  }

  /**
   * Get router data
   * @param  routeCollection  A Router, or its routes as an array
   */
  getRouterData<Controller>(routeCollection: RouteCollection<Controller>): Route<Controller>[] {
    const router = (typeof routeCollection?.getRouters === 'function') ? routeCollection.getRouters() : routeCollection;
    if (typeof router !== 'object') {
      throw new Error(`The first function argumnets (routeCollection) is expected 
                to be an instance of Startox Router class or in a right object structure.`);
    }
    return router;
  }

  /**
   * Validate dispatch: find the route for a verb and a URI by one rule (see #findRoute(), D-048).
   * On 404 and 405 the controller is the [STATUS_ERROR] route's, or null.
   * @param  routeCollection
   * @param  method   Verb (GET, POST)
   * @param  uriPath  The uri/hash to validate
   */
  validateDispatch<Controller>(routeCollection: Router<Controller>, method: string, uriPath: string): MatchResult<Controller> {
    const router = this.getRouterData(routeCollection);
    const uri = uriPath.split('/');
    const found = this.#findRoute(router, method, uri);
    const errorRoute = routeCollection.getStatusErrorRoute(found.status);
    const route = errorRoute || found.route;

    return {
      verb: method,
      status: found.status,
      controller: route?.controller ?? null,
      config: route?.config ?? null,
      path: found.path,
      vars: found.vars,
      params: found.params,
      request: {
        // dispatcher() turns the GET fields into a URLSearchParams before it gets here
        get: this.#state?.request?.get as URLSearchParams | undefined,
        post: this.#state?.request?.post,
      },
    };
  }

  /**
   * Find the route for a request, by one rule (D-048): the first route, in the order they were
   * registered, that matches the whole path and accepts the method gives 200. Otherwise 405 when a
   * route for another method matches the whole path, else 404. A route that matches only part of
   * the path never counts (audit F3).
   * @param  router  The routes
   * @param  method  The request method
   * @param  uri     The URI split on "/"
   * @return { status, route, path, vars, params }: all empty unless 200
   */
  #findRoute<Controller>(router: Route<Controller>[], method: string, uri: string[]): {
    status: DispatchStatus;
    route: Route<Controller> | null;
    path: string[];
    vars: Record<string, string[]>;
    params: Record<string, string>;
  } {
    let otherMethodMatches = false;
    for (const route of router) {
      if (route.pattern === '[STATUS_ERROR]') {
        continue;
      }
      // Any string; a method that is not a verb is in no route
      const acceptsMethod = route.verb.includes(method as HttpVerb);
      // A broken pattern throws only for a route this request could use (guard, roadmap 4.1)
      const match = this.#matchRoute(route.pattern, uri, acceptsMethod);
      if (match.hasError || match.path.length !== uri.length) {
        continue;
      }
      if (acceptsMethod) {
        const path = match.path.filter((part) => part !== '');
        return {
          status: 200, route, path, vars: match.vars, params: match.params,
        };
      }
      otherMethodMatches = true;
    }
    return {
      status: otherMethodMatches ? 405 : 404, route: null, path: [], vars: {}, params: {},
    };
  }

  /**
   * Match one route pattern against the URI parts, segment by segment
   * @param  pattern       The route pattern
   * @param  uri           The URI split on "/"
   * @param  throwInvalid  Throw for a pattern in braces that is not a valid regex
   * @return { hasError, path, vars, params }: hasError when a required segment does not match
   */
  #matchRoute(pattern: string, uri: string[], throwInvalid = true): {
    hasError: boolean;
    path: string[];
    vars: Record<string, string[]>;
    params: Record<string, string>;
  } {
    const segments = this.#compilePattern(pattern);
    const vars: Record<string, string[]> = {};
    const params: Record<string, string> = {};
    let path: string[] = [];
    let parts = uri;

    for (let x = 0; x < segments.length; x++) {
      const segment = segments[x];
      if (throwInvalid && segment.isPattern && segment.regex === null) {
        // A pattern in braces that is not a valid regular expression throws once a dispatch reaches it
        this.#segmentRegex(segment.value, { throwInvalid: true });
      }
      const part = this.#validateParts(parts, segment);
      if (part) {
        if (part[0]) {
          // A named pattern keys its value by name; anything else by its position after the leading slash
          const position = (x - 1) < 0 ? 0 : (x - 1);
          vars[segment.name ?? position] = part;
          // params: the same parts as plain text, decoded and joined; an unnamed regex by position (D-049)
          const text = parts.slice(0, part.length).map((uriPart) => this.#decodePart(uriPart)).join('/');
          params[segment.name || position] = text;
        }
        path = path.concat(part);
        parts = parts.slice(part.length);
      } else if (segment.isRequired) {
        return {
          hasError: true, path, vars, params,
        };
      }
    }
    return {
      hasError: false, path, vars, params,
    };
  }

  /**
   * Split a route pattern into its segments, once per pattern
   * @param  pattern
   * @return [{ isPattern, name, value, regex, isRequired }] for each segment
   */
  #compilePattern(pattern: string): Segment[] {
    if (!this.#compiledPatterns.has(pattern)) {
      const segments = this.#escapeForwardSlash(pattern).split('/').map((segment) => {
        const { isPattern, name, value } = this.#getMatchPattern(segment);
        // Only a pattern in braces is a regular expression; a literal matches its own text (D-048)
        return {
          isPattern,
          name,
          value: isPattern ? value : segment,
          regex: isPattern ? this.#segmentRegex(value) : undefined,
          isRequired: this.#isRequiredSegment(segment),
        };
      });
      this.#compiledPatterns.set(pattern, segments);
    }
    // Set above when it was missing
    return this.#compiledPatterns.get(pattern) as Segment[];
  }

  /**
   * This will validate each part
   * @param  uri      Uri path as array items
   * @param  segment  Compiled pattern segment to validate the parts against
   * @return Will return each valid part as array items
   */
  #validateParts(uri: string[], segment: Segment): string[] | false {
    const { regex, value } = segment;
    const uriParts: string[] = [];
    let hasError = false;
    if (!segment.isPattern) {
      return this.#matchLiteral(uri, value);
    }
    if (regex === null) {
      return false;
    }
    for (let x = 0; x < uri.length; x++) {
      const part = this.#decodePart(uri[x]);
      if (part === null) {
        hasError = true;
        break;
      }
      uriParts.push(this.htmlspecialchars(part));
      const join = uriParts.join('/');
      // A pattern segment always has a regex; null was handled above
      if (join.match(regex as RegExp)) {
        if (value !== '.+') return uriParts;
      } else {
        hasError = true;
      }
    }
    // A catch-all needs at least one part (audit F20)
    if (!hasError && value === '.+' && uriParts.length > 0) return uriParts;
    return false;
  }

  /**
   * A literal segment matches one URI part with exactly its text, after percent-decoding (D-048)
   * @param  uri      Uri path as array items
   * @param  literal  The segment as written in the route
   * @return The part, HTML-escaped like every matched part, or false
   */
  #matchLiteral(uri: string[], literal: string): string[] | false {
    if (uri.length === 0) {
      return false;
    }
    const part = this.#decodePart(uri[0]);
    return (part === literal) ? [this.htmlspecialchars(part)] : false;
  }

  /**
   * Decode one URI part
   * @param  part  A percent-encoded URI part
   * @return Null when the encoding is malformed (such as "%"), so the part matches nothing (audit F7)
   */
  #decodePart(part: string): string | null {
    try {
      return decodeURIComponent(part);
    } catch (error) {
      if (error instanceof URIError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Build the regular expression for one route segment.
   * Literal segments are used as regular expressions too, so a literal such as "c++" is not
   * a valid one. Such a segment matches nothing instead of breaking every dispatch (audit F5).
   * @param  value                 Segment pattern
   * @param  options
   * @param  options.throwInvalid  Throw the SyntaxError instead of returning null
   * @return Null when the pattern is not a valid regular expression
   */
  #segmentRegex(value: string, { throwInvalid = false } = {}): RegExp | null {
    try {
      return new RegExp(`^${value}$`);
    } catch (error) {
      if (error instanceof SyntaxError && !throwInvalid) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a state handler instance
   * @param  serverParams  expects an dynamic object that can act as an server parameter
   */
  initStateHandler(serverParams: Dynamic<Record<string, unknown>>): StateHandler {
    return new StateHandler(() => {
      const location: Partial<Location> = (typeof window === 'object') ? (window?.location ?? {}) : {};
      const query = this.#paramsToObj(location.search ?? '');
      const hash = ((typeof location.hash === 'string') ? location.hash : '');
      const fragment = hash.replace(`#${this.#configs.fragmentPrefix}`, '');
      return {
        method: 'GET',
        server: {
          host: (location.href ?? ''),
          hash,
          fragment: `/${fragment}`,
          path: (location.pathname ?? '/'),
          auto: (location.pathname && location.pathname.length > 1 ? location.pathname : `/${fragment}`),
          query,
          ...this.#getDynUri(serverParams) as object,
        },
        request: {
          get: query,
          post: {},
        },
      };
    });
  }

  /**
   * Get possible dynamic Server parameters
   * @param  path  A string or object, or a function that returns one
   */
  #getDynUri(path: Dynamic<unknown>): string | object {
    const uriPath = (typeof path === 'function') ? path() : path;
    if (typeof uriPath !== 'string' && typeof uriPath !== 'object') {
      throw new Error('Path has to be returned a string or object!');
    }
    // typeof null is 'object' too: null passes, and fails later where it is used
    return uriPath as string | object;
  }

  /**
   * Object to form data
   * NOTE: Will not apply automatically, as it won't work with push states.
   * @param  request
   * @return Instance of formData.
   */
  objToFormData(request: Record<string, string | Blob>): FormData {
    const formData = new FormData();
    Object.entries(request).forEach(([key, value]) => {
      formData.append(key, value);
    });
    return formData;
  }

  /**
   * This will handle the post method
   */
  #catchFormEvents(): void {
    if (this.#configs.catchForms && (typeof document === 'object')) {
      document.addEventListener('submit', (event) => {
        const url = new URL((event.target as HTMLFormElement).action);
        // A form for another site leaves the page as usual (audit F16)
        if (url.origin !== window.location.origin) {
          return;
        }
        event.preventDefault();
        this.#form = event.target as HTMLFormElement;
        const formData = new FormData(this.#form);
        const method = this.getFormMethod(this.#form).toUpperCase();
        if (method === 'POST' || method === 'PUT') {
          this.mapTo(method, url, this.#paramsToObj(url.search), Object.fromEntries(formData));
        } else {
          const searchObj = this.#paramsToObj(url.search);
          const formObj = this.#paramsToObj(formData);
          const assignObj = Object.assign(searchObj, formObj);
          this.navigateTo(url, assignObj);
        }
      });
    }
  }

  /**
   * With catchLinks, a click on a same-origin link navigates through the dispatcher (D-047)
   */
  #catchLinkEvents(): void {
    if (!this.#configs.catchLinks || (typeof document !== 'object')) {
      return;
    }
    document.addEventListener('click', (event) => {
      const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href]');
      if (!link || !this.#isLinkForUs(event, link)) {
        return;
      }
      event.preventDefault();
      const url = new URL(link.href);
      this.navigateTo(url, this.#paramsToObj(url.search));
    });
  }

  /**
   * Should the dispatcher take this link click, or leave it to the browser?
   * @param  event
   * @param  link
   */
  #isLinkForUs(event: MouseEvent, link: HTMLAnchorElement): boolean {
    // Another handler took it, or the user asks for a new tab, window or a download
    if (event.defaultPrevented || event.button !== 0) return false;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return false;
    const target = link.getAttribute('target');
    if ((target && target !== '_self') || link.hasAttribute('download')) return false;
    if (link.hasAttribute('data-pilot-ignore')) return false;

    const url = new URL(link.href);
    if (url.origin !== window.location.origin) return false;
    // Only the hash differs: an anchor on this page
    const samePage = (url.pathname === window.location.pathname && url.search === window.location.search);
    return !(samePage && url.hash !== '');
  }

  /**
   * Get HTTP request method from form tag
   * @param  form
   */
  getFormMethod(form: HTMLFormElement | null | undefined): string {
    if (form?.dataset?.method) {
      return form.dataset.method;
    }
    return form?.getAttribute('method') ?? form?.method ?? 'GET';
  }

  /**
   * Get closet form element
   * @param  event  An event from the form or an element inside it
   * @return The form's fields
   */
  getFormData(event: Event): Record<string, FormDataEntryValue> {
    let formEl = event.target as HTMLFormElement | null;

    if (!(formEl instanceof HTMLFormElement)) {
      formEl = (event.target as Element).closest('form');
    }

    if (!formEl) {
      throw new Error('The Dispatcher getFormData method was unable to locate a valid closest form element from the provided event.');
    }

    return Object.fromEntries(new FormData(formEl));
  }

  /**
   * Read the first {name:pattern} or {pattern} in a route segment
   * @param  matchStr  One segment of a route pattern
   * @return { isPattern, name, value }; name is '' for an unnamed pattern, undefined for a literal
   */
  #getMatchPattern(matchStr: string): MatchPattern {
    const bracedParts = matchStr.match(/{(.*?)}/g);
    if (bracedParts) {
      const patterns = bracedParts.map((item) => item.slice(1, -1));
      const extractPattern = patterns[0].split(':');
      const length = extractPattern.length - 1;
      const patternValue = this.#unescapeForwardSlash(extractPattern[length].trim());
      return {
        isPattern: true,
        name: ((extractPattern.length > 1) ? extractPattern[0].trim() : ''),
        value: patternValue,
      };
    }
    return { isPattern: false };
  }

  /**
   * Is the route segment required? An optional one is written "(...)?"
   * @param  pattern
   */
  #isRequiredSegment(pattern: string): boolean {
    const value = pattern.substring(pattern.length - 2);
    return (value !== '?(' && value !== ')?');
  }

  /**
   * Escape forward slash
   * @param  pattern
   */
  #escapeForwardSlash(pattern: string): string {
    return pattern.replace(/{[^}]+}/g, (match) => match.replace(/\//g, '[#SC#]'));
  }

  /**
   * Unescape forward slash
   * @param  pattern
   */
  #unescapeForwardSlash(pattern: string): string {
    return pattern.replace(/\[#SC#\]/g, '/');
  }

  /**
   * Assign response
   * @param  response  The fields to set; the rest get the defaults
   */
  #assignResponse<Controller>(response: Partial<DispatchResponse<Controller>>): DispatchResponse<Controller> {
    // dispatcher() passes every field (validateDispatch's result), so the request defaults are never used
    return {
      verb: 'GET',
      status: 404,
      controller: null,
      path: [],
      vars: {},
      params: {},
      form: this.#form,
      fromHistory: false,
      request: {
        get: {},
        post: {},
      },
      ...response,
    } as DispatchResponse<Controller>;
  }

  /**
   * Assign request
   * @param  state
   */
  #assignRequest(state: Partial<RequestState>): RequestState {
    return {
      method: 'GET',
      request: {
        path: {},
        get: {},
        post: {},
      },
      ...state,
    };
  }

  /**
   * Escape special cahracters
   */
  htmlspecialchars(value: string): string {
    const char = this.#specCharMap;
    const keys = Object.keys(char);
    // A character class lists the characters without separators: [&<>"']
    const regex = new RegExp(`[${keys.join('')}]`, 'g');
    return value.replace(regex, (match) => char[match]);
  }

  /**
   * Decode html special characers
   */
  htmlspecialchars_decode(value: string): string {
    const char = this.#specCharMap;
    const values = Object.values(char);
    const regex = new RegExp(values.join('|'), 'g');
    // Every match is one of the values, so a key is always found
    return value.replace(regex, (match) => Object.keys(char).find((key) => char[key] === match) as string);
  }

  /**
   * Start URLSearchParams instance
   * @param  value  Any value: URLSearchParams turns it into text (an object or FormData by its entries)
   */
  #params(value: unknown): URLSearchParams {
    return new URLSearchParams(value as QueryInit);
  }

  /**
   * Query string to object
   * @param  valueArg  A query string, URLSearchParams or FormData
   */
  #paramsToObj(valueArg: string | URLSearchParams | FormData): Record<string, string> {
    let value = valueArg;
    if (!(value instanceof URLSearchParams)) {
      value = this.#params(value);
    }
    const entries = value.entries();
    return [...entries].reduce((items, [key, val]) => Object.assign(items, { [key]: val }), {});
  }

  /**
   * Build a query search parama
   * @param  request  GET fields to add to the current query
   */
  buildQueryObj(request: unknown): URLSearchParams {
    return this.#params(Object.assign(this.serverParams('query')() as object, request));
  }

  /**
   * Build query path, string and fragment
   * @param  pathArg
   * @param  requestArg
   * @return { path, query, pathname }: the path with its query string, the GET fields, the path to match
   */
  buildGetPath(pathArg: string | URL, requestArg?: RequestFields | false): {
    path: string;
    query: RequestFields | false | undefined;
    pathname: string | URL;
  } {
    let path = pathArg;
    let request = requestArg;
    // A query string in the path moves into the request, so "/about?x=1" matches "/about" (audit F26)
    if (typeof path === 'string' && !path.startsWith('#') && path.includes('?')) {
      const queryStart = path.indexOf('?');
      const pathQuery = this.#paramsToObj(path.slice(queryStart + 1));
      path = path.slice(0, queryStart);
      request = { ...pathQuery, ...(typeof request === 'object' ? request : {}) };
    }
    // With fragmentPrefix "!", "#about" becomes "#!about"; "#!about" stays as it is (audit F27)
    const { fragmentPrefix } = this.#configs;
    if (typeof path === 'string' && path.startsWith('#') && !path.startsWith(`#${fragmentPrefix}`)) {
      path = `#${fragmentPrefix}${path.substring(1)}`;
    }
    let pathname = path;
    let queryStr = '';
    if (typeof request === 'object') {
      const query = this.#params(request);
      queryStr = query.toString();
    }

    if (path instanceof URL) {
      const fragment = path.hash.substring(1);
      pathname = path.pathname;
      if (fragment.length > 0) {
        pathname = `/${fragment}`;
      }
      path = path.pathname + this.getQueryStr(queryStr) + path.hash;
    } else if (typeof queryStr === 'string' && queryStr.length > 0) {
      if (path.indexOf('#') === 0) {
        path = `/${this.getQueryStr(queryStr)}${path}`;
      } else {
        path += this.getQueryStr(queryStr);
      }
    }
    return { path, query: request, pathname };
  }

  /**
   * Get base dir from config
   * @param path
   * @param add   true adds the root in front
   */
  baseDir(path: string, add?: boolean): string {
    let baseDir = path;
    if (this.#configs.root.length > 0) {
      baseDir = this.#removeRoot(path);
      if (add === true) {
        baseDir = this.#configs.root + baseDir;
      }
      baseDir = this.addLeadingSlash(baseDir);
    }
    return baseDir;
  }

  /**
   * Remove the root from the start of a path. Only a whole leading part is removed:
   * with root "/app", "/app/page" becomes "/page", but "/apple" and "/shop/app" stay as they are (audit F18).
   * @param  path
   */
  #removeRoot(path: string): string {
    const { root } = this.#configs;
    const rootWithSlash = root.endsWith('/') ? root : `${root}/`;
    if (path === root || path.startsWith(rootWithSlash)) {
      return path.slice(root.length);
    }
    return path;
  }

  /**
   * Add leading slash to string
   * @param pathArg
   */
  addLeadingSlash(pathArg: string): string {
    let path = pathArg;
    if (!path.startsWith('/')) path = `/${path}`;
    return path;
  }

  /**
   * Return query string part if exist
   * @param  queryStr
   */
  getQueryStr(queryStr: string): string {
    if (typeof queryStr === 'string' && queryStr.length > 0) {
      return `?${queryStr}`;
    }
    return '';
  }
}
