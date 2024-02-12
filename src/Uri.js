/**
 * Startox FastRoute and dispatcher
 * Is an 
 */
export class Uri {

    #uri = {};

    constructor(uri = {}) {
        this.#uri = Object.assign({
            scheme: 'https',
            host: 'example.com',
            port: '443',
            user: '',
            pass: '',
            path: '',
            query: '',
            fragment: ''
        }, uri);
    }

    /**
     * Set URI host (http, https)
     * @param {string} scheme
     */
    setScheme(scheme) {
        this.#uri.scheme = scheme;
    }

    /**
     * Set URI host (example.com)
     * @param {string} host
     */
    setHost(host) {
        this.#uri.host = host;
    }

    /**
     * Set URI port (443)
     * @param {string} port
     */
    setPost(port) {
        this.#uri.port = port;
    }

    /**
     * Set URI user
     * @param {string} user
     */
    setUser(user) {
        this.#uri.user = user;
    }

    /**
     * Set URI user
     * @param {string} pass
     */
    setPass(pass) {
        this.#uri.pass = pass;
    }

    /**
     * Set URI path (/test1/test2)
     * @param {string} path
     */
    setPath(path) {
        this.#uri.path = path;
    }

    /**
     * Set URI query (id=82&slug=lorem)
     * @param {string} query
     */
    setQuery(query) {
        this.#uri.query = query;
    }

    /**
     * Set URI fragment (#myHashTag)
     * @param {string} fragment
     */
    setFragment(fragment) {
        this.#uri.fragment = fragment;
    }

    getScheme() {
        return this.#uri.scheme;
    }

    getUserInfo() {
        if(this.#uri.user && this.#uri.pass) {
            return this.#uri.user+':'+this.#uri.pass;
        }
        return this.#uri.user;
    }

    getPort() {
        const port = parseInt(this.#uri.port);
        if(!isNaN(port)) {
            return port;
        }
        return "";
    }

    getHost() {
        return this.#uri.host;
    }

    getAuthority() {
        let getUserInfo, port, host, auth = "";
        if((getUserInfo = this.getUserInfo()) && this.getHost()) {
            auth += getUserInfo+'@'+this.getHost();
        } else {
            auth += this.getHost();
        }
        if(port = this.getPort()) auth += ':'+port;
        return auth;
    }

    getPath() {
        return this.rawUrlEncode(this.#uri.path);
    }

    getQuery() {
        return this.rawUrlEncode(this.#uri.query);
    }

    /**
     * Get fragment (get the anchor/hash/fragment (#anchor-12) link from URI "without" the hash)
     * @return {string}
     */
    getFragment() {
        return this.rawUrlEncode(this.#uri.fragment);
    }


    getUri() {
        let uri = "", scheme, auth, path, query, fragment;
        if(scheme = this.getScheme()) uri += scheme+":";
        if(auth = this.getAuthority()) uri += "//"+auth;
        if(path = this.getPath()) uri += path;
        if(query = this.getQuery()) uri += "?"+query;
        if(fragment = this.getFragment()) uri += "#"+fragment;
        return uri;
    }

    setLocation(obj) {
        global.location = Object.assign(obj, {
            href: 'http://example.com',
            pathname: '',
            search: '',
            hash: '',
            assign: (url) => {
                //console.log(`Mock location assign called with url: ${url}`);
            }
        });
    }

    rawUrlEncode(str, allowPath) {
        const replacements = {
            '%3D': '=',
            '%26': '&',
            '%5B': '[',
            '%5D': ']',
            '%2F': '/'
        };
        const keys = Object.keys(replacements);
        const pattern = new RegExp(keys.join("|"), "g");
        return encodeURIComponent(str).replace(pattern, match => replacements[match]);
    }

    #defaultEventHandler() {
        if(typeof window !== "object") {

            const handler = {};
            global.window = {
                addEventListener: (event, fn) => {
                    handler[event] = fn;
                },
                dispatchEvent: function(event) {
                    handler.dispatched(event);
                }
            };


            global.document = {
                addEventListener: (event, handler) => {
                }
            };

            global.CustomEvent = class {
                constructor(event, params = { bubbles: false, cancelable: false, detail: undefined }) {
                    this.event = event;
                    this.bubbles = params.bubbles;
                    this.cancelable = params.cancelable;
                    this.detail = params.detail;
                }
            };

            global.history = {
                pushState: (state, title, url) => {
                },
                replaceState: (state, title, url) => {
                },
                go: (num) => {
                }
            };

            global.location = {
                href: '',
                pathname: '',
                search: '',
                hash: '',
                assign: (url) => {
                }
            };
        }
    }
}
