import StateHandler from './StateHandler.js';
import Router from './Router.js';

/**
 * Stratox Dispatcher
 * Author: Daniel Ronkainen
 * Apache License Version 2.0
 */
export default class Dispatcher {
  #handler;

  #state = {};

  #configs = {};

  #form = null;

  // Route patterns split into segments with their regular expressions, built once per pattern
  #compiledPatterns = new Map();

  #specCharMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  constructor(configs = {}) {
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
   * @param  {string} path    A uri path or anchor with path e.g. #page1/page2/page3
   * @param  {Object} request GET request
   * @return {void}
   */
  navigateTo(path, request = {}) {
    return this.mapTo('GET', path, request);
  }

  // Same as method "navigateTo"
  pushToState(path, request = {}) {
    return this.mapTo('GET', path, request);
  }

  /**
   * Push post state
   * @param  {string} path     URI path or hash
   * @param  {Object} request  Add post form data
   * @return {Object} The post data it was given
   */
  postTo(path, request = {}) {
    this.mapTo('POST', path, false, request);
    return request;
  }

  /**
   * Push put state
   * @param  {string} path     URI path or hash
   * @param  {Object} request  Add post form data
   * @return {Object} The post data it was given
   */
  putTo(path, request = {}) {
    this.mapTo('PUT', path, false, request);
    return request;
  }

  /**
   * Push delete state
   * @param  {string} path    A uri path or anchor with path e.g. #page1/page2/page3
   * @param  {Object} request GET request
   * @return {void}
   */
  deleteTo(path, request = {}) {
    return this.mapTo('DELETE', path, request);
  }

  /**
   * Push post state
   * @param  {string} verb     GET, POST, PUT, DELETE
   * @param  {string} path     URI path or hash
   * @param  {Object} request  Add post form data
   * @return {Object} Instance of formData
   */
  mapTo(verb, path, requestGet = {}, requestPost = {}) {
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
   * @param  {string} key Get param, if not specified then get all
   * @param  {object} obj Add object that you want to merge current param with (KEY is required)
   * @return {callable|object}
   */
  serverParams(key, obj) {
    if (typeof key === 'string') {
      const inst = this;
      return () => Object.assign(inst.#handler.getState().server[key], obj);
    }
    return this.#handler.getState().server;
  }

  /**
   * Get request as dynamic variable
   * @param  {string} key Get param, if not specified then get all
   * @param  {object} obj Add object that you want to merge current param with (KEY is required)
   * @return {callable|object}
   */
  request(key, obj) {
    if (typeof key === 'string') {
      const inst = this;
      return () => Object.assign((inst.#state.request?.[key] ?? '/'), obj);
    }
    return this.#state.request;
  }

  /**
   * Push state
   * @param  {string} path  URI
   * @param  {Object} stateArg {method: GET|POST, request: {...More data} }
   * @return {void}
   */
  pushState(path, stateArg = {}) {
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
   * @param  {Function} fn callback
   * @return {void}
   */
  dispatcher(routeCollection, path, fn) {
    const inst = this;
    // if(routeCollection.hasPostRoutes())
    this.#catchFormEvents();
    this.#catchLinkEvents();
    this.#handler.on('popstate', (eventArg) => {
      const event = eventArg;
      event.details.request.get = inst.buildQueryObj(event.details.request.get);
      inst.#state = inst.#assignRequest(event.details);
      const uriPath = inst.baseDir(inst.#getDynUri(path).toString());
      const dispatcher = inst.validateDispatch(routeCollection, inst.#state.method, uriPath);
      // Back and Forward fire the browser's own popstate event; pushState and refresh emit a plain object (audit F30)
      const fromHistory = (typeof PopStateEvent === 'function' && event instanceof PopStateEvent);
      const response = inst.#assignResponse({ ...dispatcher, fromHistory });
      fn.apply(inst, [response, response.status]);
    });

    this.#handler.emitPopState();
  }

  /**
   * Get the state handler
   * @return {StateHandler}
   */
  getStateHandler() {
    return this.#handler;
  }

  /**
   * Get router data
   * @param  {object} routeCollection
   * @return {object}
   */
  getRouterData(routeCollection) {
    const router = (typeof routeCollection?.getRouters === 'function') ? routeCollection.getRouters() : routeCollection;
    if (typeof router !== 'object') {
      throw new Error(`The first function argumnets (routeCollection) is expected 
                to be an instance of Startox Router class or in a right object structure.`);
    }
    return router;
  }

  /**
   * Validate dispatch: find the route for a verb and a URI.
   * The routes are tried in order. The first one that matches the whole URI wins. Otherwise the first one
   * that matched its own segments is the fallback, returned with the error status: 404, or 405 when the
   * verb is not GET and a route tried does not accept it. The status, path and vars come from the last
   * route tried (audit F21).
   * @param  {Router|array} routeCollection
   * @param  {string} method  Verb (GET, POST)
   * @param  {uri} dipatch    The uri/hash to validate
   * @return {object|false}
   */
  validateDispatch(routeCollection, method, dipatch) {
    const router = this.getRouterData(routeCollection);
    const uri = dipatch.split('/');
    // The result of the last route tried; empty when there is no route
    let match = { hasError: false, path: [], vars: {} };
    let current;
    let fallback;
    let statusError = 404;

    for (let i = 0; i < router.length; i++) {
      match = { hasError: false, path: [], vars: {} };
      if (router[i].verb.includes(method)) {
        match = this.#matchRoute(router[i].pattern, uri);
        if (!match.hasError) {
          if (!fallback) {
            fallback = router[i];
          }
          if (uri.length === match.path.length) {
            current = router[i];
            break;
          }
        }
      } else if (method !== 'GET') {
        statusError = 405;
      }
    }

    if (typeof current !== 'object') {
      current = (typeof fallback === 'object') ? fallback : {};
    }

    const { hasError, path, vars } = match;
    const statusCode = (!hasError && (uri.length === path.length) ? 200 : statusError);
    const filterPath = [...path].filter((val) => (val !== ''));
    const errorRoute = routeCollection.getStatusErrorRoute(statusCode);
    const route = errorRoute || current;

    return {
      verb: method,
      status: statusCode,
      controller: route?.controller ?? null,
      config: route?.config ?? null,
      path: filterPath,
      vars,
      request: {
        get: this.#state?.request?.get,
        post: this.#state?.request?.post,
      },
    };
  }

  /**
   * Match one route pattern against the URI parts, segment by segment
   * @param  {string} pattern  The route pattern
   * @param  {array}  uri      The URI split on "/"
   * @return {object} { hasError, path, vars }: hasError when a required segment does not match
   */
  #matchRoute(pattern, uri) {
    const segments = this.#compilePattern(pattern);
    const vars = {};
    let path = [];
    let parts = uri;

    for (let x = 0; x < segments.length; x++) {
      const segment = segments[x];
      if (segment.isPattern && segment.regex === null) {
        // A pattern in braces that is not a valid regular expression throws once a dispatch reaches it
        this.#segmentRegex(segment.value, { throwInvalid: true });
      }
      const part = this.#validateParts(parts, segment);
      if (part) {
        if (part[0]) {
          // A named pattern keys its value by name; anything else by its position after the leading slash
          const position = (x - 1);
          const key = (segment.name ?? (position < 0 ? 0 : position));
          vars[key] = part;
        }
        path = path.concat(part);
        parts = parts.slice(part.length);
      } else if (segment.isRequired) {
        return { hasError: true, path, vars };
      }
    }
    return { hasError: false, path, vars };
  }

  /**
   * Split a route pattern into its segments, once per pattern
   * @param  {string} pattern
   * @return {array} [{ isPattern, name, value, regex, isRequired }] for each segment
   */
  #compilePattern(pattern) {
    if (!this.#compiledPatterns.has(pattern)) {
      const segments = this.#escapeForwardSlash(pattern).split('/').map((segment) => {
        const { isPattern, name, value } = this.#getMatchPattern(segment);
        return {
          isPattern,
          name,
          value: isPattern ? value : segment,
          regex: this.#segmentRegex(isPattern ? value : segment),
          isRequired: this.#isLossyParam(segment),
        };
      });
      this.#compiledPatterns.set(pattern, segments);
    }
    return this.#compiledPatterns.get(pattern);
  }

  /**
   * This will validate each part
   * @param  {array} uri        Uri path as array items
   * @param  {object} segment   Compiled pattern segment to validate the parts against
   * @return {array|false}      Will return each valid part as array items
   */
  #validateParts(uri, segment) {
    const { regex, value } = segment;
    const uriParts = [];
    let hasError = false;
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
      if (join.match(regex)) {
        if (value !== '.+') return uriParts;
      } else {
        hasError = true;
      }
    }
    if (!hasError && value === '.+') return uriParts;
    return false;
  }

  /**
   * Decode one URI part
   * @param  {string} part   A percent-encoded URI part
   * @return {string|null}   Null when the encoding is malformed (such as "%"), so the part matches nothing (audit F7)
   */
  #decodePart(part) {
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
   * @param  {string}  value              Segment pattern
   * @param  {object}  options
   * @param  {boolean} options.throwInvalid  Throw the SyntaxError instead of returning null
   * @return {RegExp|null}   Null when the pattern is not a valid regular expression
   */
  #segmentRegex(value, { throwInvalid = false } = {}) {
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
   * @param  {object} serverParams expects an dynamic object that can act as an server parameter
   * @return {StateHandler}
   */
  initStateHandler(serverParams) {
    const inst = this;
    return new StateHandler(() => {
      const location = (typeof window === 'object') ? (window?.location ?? {}) : {};
      const query = inst.#paramsToObj(location.search ?? '');
      const hash = ((typeof location.hash === 'string') ? location.hash : '');
      const fragment = hash.replace(`#${inst.#configs.fragmentPrefix}`, '');
      return {
        method: 'GET',
        server: {
          host: (location.href ?? ''),
          hash,
          fragment: `/${fragment}`,
          path: (location.pathname ?? '/'),
          auto: (location.pathname && location.pathname.length > 1 ? location.pathname : `/${fragment}`),
          query,
          ...inst.#getDynUri(serverParams),
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
   * @param  {string} path
   * @return {object}
   */
  #getDynUri(path) {
    const uriPath = (typeof path === 'function') ? path() : path;
    if (typeof uriPath !== 'string' && typeof uriPath !== 'object') {
      throw new Error('Path has to be returned a string or object!');
    }
    return uriPath;
  }

  /**
   * Object to form data
   * NOTE: Will not apply automatically, as it won't work with push states.
   * @param  {object} request
   * @return {object} Instance of formData.
   */
  objToFormData(request) {
    const formData = new FormData();
    Object.entries(request).forEach(([key, value]) => {
      formData.append(key, value);
    });
    return formData;
  }

  /**
   * This will handle the post method
   * @return {void}
   */
  #catchFormEvents() {
    const inst = this;
    if (this.#configs.catchForms && (typeof document === 'object')) {
      document.addEventListener('submit', (event) => {
        const url = new URL(event.target.action);
        // A form for another site leaves the page as usual (audit F16)
        if (url.origin !== window.location.origin) {
          return;
        }
        event.preventDefault();
        inst.#form = event.target;
        const formData = new FormData(inst.#form);
        const method = inst.getFormMethod(inst.#form).toUpperCase();
        if (method === 'POST' || method === 'PUT') {
          inst.mapTo(method, url, inst.#paramsToObj(url.search), Object.fromEntries(formData));
        } else {
          const searchObj = inst.#paramsToObj(url.search);
          const formObj = inst.#paramsToObj(formData);
          const assignObj = Object.assign(searchObj, formObj);
          inst.navigateTo(url, assignObj);
        }
      });
    }
  }

  /**
   * With catchLinks, a click on a same-origin link navigates through the dispatcher (D-047)
   * @return {void}
   */
  #catchLinkEvents() {
    if (!this.#configs.catchLinks || (typeof document !== 'object')) {
      return;
    }
    document.addEventListener('click', (event) => {
      const link = event.target?.closest?.('a[href]');
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
   * @param  {MouseEvent}        event
   * @param  {HTMLAnchorElement} link
   * @return {boolean}
   */
  #isLinkForUs(event, link) {
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
   * @param  {object} form
   * @return {string}
   */
  getFormMethod(form) {
    if (form?.dataset?.method) {
      return form.dataset.method;
    }
    return form?.getAttribute('method') ?? form?.method ?? 'GET';
  }

  /**
   * Get closet form element
   * @param  {object} event
   * @return {object}
   */
  getFormData(event) {
    let formEl = event.target;

    if (!(formEl instanceof HTMLFormElement)) {
      formEl = event.target.closest('form');
    }

    if (!formEl) {
      throw new Error('The Dispatcher getFormData method was unable to locate a valid closest form element from the provided event.');
    }

    return Object.fromEntries(new FormData(formEl));
  }

  /**
   * Read the first {name:pattern} or {pattern} in a route segment
   * @param  {string} matchStr  One segment of a route pattern
   * @return {object} { isPattern, name, value }; name is '' for an unnamed pattern, undefined for a literal
   */
  #getMatchPattern(matchStr) {
    const matchPatter = matchStr.match(/{(.*?)}/g);
    if (matchPatter) {
      const patterns = matchPatter.map((item) => item.slice(1, -1));
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
   * Check if is a loosy pattern parameter
   * @param  {string}  pattern
   * @return {Boolean}
   */
  #isLossyParam(pattern) {
    const value = pattern.substring(pattern.length - 2);
    return (value !== '?(' && value !== ')?');
  }

  /**
   * Escape forward slash
   * @param  {string} pattern
   * @return {string}
   */
  #escapeForwardSlash(pattern) {
    return pattern.replace(/{[^}]+}/g, (match) => match.replace(/\//g, '[#SC#]'));
  }

  /**
   * Unescape forward slash
   * @param  {string} pattern
   * @return {string}
   */
  #unescapeForwardSlash(pattern) {
    return pattern.replace(/\[#SC#\]/g, '/');
  }

  /**
   * Assign response
   * @param  {object} response
   * @return {object}
   */
  #assignResponse(response) {
    return {
      verb: 'GET',
      status: 404,
      controller: null,
      path: [],
      vars: {},
      form: this.#form,
      fromHistory: false,
      request: {
        get: {},
        post: {},
      },
      ...response,
    };
  }

  /**
   * Assign request
   * @param  {object} state
   * @return {object}
   */
  #assignRequest(state) {
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
   * @return {string}
   */
  htmlspecialchars(value) {
    const char = this.#specCharMap;
    const keys = Object.keys(char);
    // A character class lists the characters without separators: [&<>"']
    const regex = new RegExp(`[${keys.join('')}]`, 'g');
    return value.replace(regex, (match) => char[match]);
  }

  /**
   * Decode html special characers
   * @return {string}
   */
  htmlspecialchars_decode(value) {
    const char = this.#specCharMap;
    const values = Object.values(char);
    const regex = new RegExp(values.join('|'), 'g');
    return value.replace(regex, (match) => Object.keys(char).find((key) => char[key] === match));
  }

  /**
   * Start URLSearchParams instance
   * @param  {object|string} value
   * @return {URLSearchParams}
   */
  #params(value) {
    return new URLSearchParams(value);
  }

  /**
   * Query string to object
   * @param  {string|URLSearchParams} valueArg
   * @return {object}
   */
  #paramsToObj(valueArg) {
    let value = valueArg;
    if (!(value instanceof URLSearchParams)) {
      value = this.#params(value);
    }
    const entries = value.entries();
    return [...entries].reduce((items, [key, val]) => Object.assign(items, { [key]: val }), {});
  }

  /**
   * Build a query search parama
   * @param  {object} request
   * @return {URLSearchParams}
   */
  buildQueryObj(request) {
    return this.#params(Object.assign(this.serverParams('query')(), request));
  }

  /**
   * Build query path, string and fragment
   * @param  {string} pathArg
   * @param  {object} request
   * @return {object}
   */
  buildGetPath(pathArg, requestArg) {
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
   * @param {string}  path
   * @param {bool}    add
   * @return {string}
   */
  baseDir(path, add) {
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
   * @param  {string} path
   * @return {string}
   */
  #removeRoot(path) {
    const { root } = this.#configs;
    const rootWithSlash = root.endsWith('/') ? root : `${root}/`;
    if (path === root || path.startsWith(rootWithSlash)) {
      return path.slice(root.length);
    }
    return path;
  }

  /**
   * Add leading slash to string
   * @param {string} pathArg
   * @return {string}
   */
  addLeadingSlash(pathArg) {
    let path = pathArg;
    if (!path.startsWith('/')) path = `/${path}`;
    return path;
  }

  /**
   * Return query string part if exist
   * @param  {string} queryStr
   * @return {string}
   */
  getQueryStr(queryStr) {
    if (typeof queryStr === 'string' && queryStr.length > 0) {
      return `?${queryStr}`;
    }
    return '';
  }
}
