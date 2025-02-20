import StateHandler from './StateHandler';
import Router from './Router';

/**
 * Stratox Dispatcher
 * Author: Daniel Ronkainen
 * Apache License Version 2.0
 */
export default class Dispatcher {
  #handler;

  #state = {};

  #router;

  #configs = {};

  #form = null;

  #specCharMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  constructor(configs = {}) {
    const inst = this;
    this.#configs = {
      catchForms: false, // Auto catch forms
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
   * @return {Object} Instance of formData
   */
  postTo(path, request = {}) {
    return this.mapTo('POST', path, false, request);
  }

  /**
   * Push put state
   * @param  {string} path     URI path or hash
   * @param  {Object} request  Add post form data
   * @return {Object} Instance of formData
   */
  putTo(path, request = {}) {
    return this.mapTo('PUT', path, false, request);
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
    this.#handler.on('popstate', (eventArg) => {
      const event = eventArg;
      event.details.request.get = inst.buildQueryObj(event.details.request.get);
      inst.#state = inst.#assignRequest(event.details);
      const uriPath = inst.baseDir(inst.#getDynUri(path).toString());
      const dispatcher = inst.validateDispatch(routeCollection, inst.#state.method, uriPath);
      const response = inst.#assignResponse(dispatcher);
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
   * Validate dispatch
   * @param  {string} method  Verb (GET, POST)
   * @param  {uri} dipatch    The uri/hash to validate
   * @return {object|false}
   */
  validateDispatch(routeCollection, method, dipatch) {
    const inst = this;
    const router = this.getRouterData(routeCollection);
    const uri = dipatch.split('/');
    // const foundResult = false;
    let current = {};
    let parts;
    let regexItems;
    let vars = {};
    let path = [];
    let hasError;
    let statusError = 404;

    for (let i = 0; i < router.length; i++) {
      regexItems = [];
      vars = {};
      path = [];
      hasError = false;
      parts = uri;

      if (router[i].verb.includes(method)) {
        const extractRouterData = inst.#escapeForwardSlash(router[i].pattern);
        const routerData = extractRouterData.split('/');

        for (let x = 0; x < routerData.length; x++) {
          const regex = inst.#getMatchPattern(routerData[x]);
          const hasRegex = (regex[1] !== undefined);
          const value = (hasRegex) ? regex[2] : routerData[x];
          regexItems.push(value);

          const part = inst.#validateParts(parts, value);
          if (part) {
            // Escaped
            if (part[0]) {
              const int = (x - 1);
              const key = (regex[1] ?? (int < 0 ? 0 : int));
              vars[key] = part;
            }

            path = path.concat(part);
            parts = parts.slice(part.length);
          } else if (this.#isLossyParam(routerData[x])) {
            hasError = true;
            break;
          }
        }

        if (!hasError) {
          current = router[i];
          break;
        }
      } else if (method !== 'GET') {
        statusError = 405;
      }
    }

    const statusCode = (!hasError && (uri.length === path.length) ? 200 : statusError);
    const filterPath = [...path].filter((val) => (val !== ''));
    const statusErrContr = routeCollection.getStatusError(statusCode);

    return {
      verb: method,
      status: statusCode,
      controller: (statusErrContr) || (current?.controller ?? null),
      config: (statusErrContr) || (current?.config ?? null),
      path: filterPath,
      vars,
      request: {
        get: this.#state?.request?.get,
        post: this.#state?.request?.post,
      },
    };
  }

  /**
   * This will validate each part
   * @param  {array} uri      Uri path as array items
   * @param  {string} value   Pattern value to validate part againts
   * @return {array|false}    Will return each valid part as array items
   */
  #validateParts(uri, value) {
    const inst = this;
    const uriParts = [];
    let hasError = false;
    for (let x = 0; x < uri.length; x++) {
      uriParts.push(inst.htmlspecialchars(decodeURIComponent(uri[x])));
      const join = uriParts.join('/');
      const regex = new RegExp(`^${value}$`);
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
        event.preventDefault();
        inst.#form = event.target;
        const formData = new FormData(inst.#form);
        const method = inst.getFormMethod(inst.#form).toUpperCase();
        const url = new URL(inst.#form.action);
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
   * Get HTTP request method from form tag
   * @param  {object} form
   * @return {string}
   */
  getFormMethod(form) {
    return (this.#form?.dataset?.method) ? form?.dataset?.method
      : (this.#form?.getAttribute('method') ?? (this.#form?.method ?? 'GET'));
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
   * Build and return patterns
   * @param  {string} matchStr
   * @return {array}
   */
  #getMatchPattern(matchStr) {
    const matchPatter = matchStr.match(/{(.*?)}/g);
    if (matchPatter) {
      const patterns = matchPatter.map((item) => item.slice(1, -1));
      const extractPattern = patterns[0].split(':');
      const length = extractPattern.length - 1;
      const patternValue = this.#unescapeForwardSlash(extractPattern[length].trim());
      const regex = new RegExp(`^${patternValue}$`);
      return [regex, ((extractPattern.length > 1) ? extractPattern[0].trim() : ''), patternValue];
    }
    return [];
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
    return pattern.replace(/{[^}]+}/g, (match, a) => match.replace(/\//g, '[#SC#]'));
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
    const regex = new RegExp(`[${keys.join('|')}]`, 'g');
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
  buildGetPath(pathArg, request) {
    let path = pathArg;
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
      baseDir = path.replace(this.#configs.root, '');
      if (add === true) {
        baseDir = this.#configs.root + baseDir;
      }
      baseDir = this.addLeadingSlash(baseDir);
    }
    return baseDir;
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
