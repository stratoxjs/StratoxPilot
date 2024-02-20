# StratoxPilot

Startox Pilot is an efficient and user-friendly JavaScript router. It uses regular expressions for dynamic and adaptable routing, meaning you can get as simple or as complex as you need with your navigation, and Startox Pilot can handle it. As a Universal JavaScript Library, Startox Pilot is platform-agnostic, operating independently without external dependencies. This makes it a versatile choice for developers seeking a reliable, high-performance routing solution.

> Stratox pilot is quite advance and modular router and state handler in
> a small package.

## Installation
```javascript
npm install @stratox/pilot
```

##  A basic example
Bellow is  a basic but complete example. I breakdown in the guide bellow.
```javascript
import { Router } from "Router";
import { Dispatcher } from "Dispatcher";

const router = new Router();
const dispatcher = new Dispatcher();

// GET: example.se/
router.get('/', function() {
    console.log("Start page");
});

// GET: example.se/#about 
// REGULAR URI paths (example.se/about) is of course also supported!
router.get('/about', function(vars, request, path) {
    const page = vars[0].pop();
    console.log(`The current page is: ${page}`);
});

// GET: example.se/#articles/824/hello-world
router.get('/articles/{id:[0-9]+}/{slug:[^/]+}', function(vars, request, path) {
    const id = vars.id.pop();
    const slug = vars.slug.pop();
    console.log(`Article post ID is: ${id} and post slug is: ${slug}.`);
});

// POST: example.se/#post/contact
router.post('/post/contact', function(vars, request, path) {
    console.log(`Contact form catched with post:`, request.post);
});

// Will catch 404 and 405 HTTP Status Errors codes
// Not required you can also handle it directly in the dispatcher
router.get('[STATUS_ERROR]', function(vars, request, path, statusCode) {
    if(statusCode === 404) {
        console.log("404 Page not found", statusCode);
    } else {
        console.log("405 Method not allowed", statusCode);
    }
});

dispatcher.dispatcher(router, dispatcher.serverParams("fragment"), function(response, statusCode) {
	// response.controller what the routers above second argument is being fed with. 
	response.controller(response.vars, response.request, response.path, statusCode);
});
// URI HASH: dispatcher.serverParams("fragment") // Fragment is HASH without "#" character.
// URI PATH: dispatcher.serverParams("path") // Regular URI path
// SCRIPT PATH: dispatcher.request("path") // Will work without browser window.history support

// You can very easily make GET requests/navigate to a new page with:
// dispatcher.navigateTo("#articles/824/hello-world", { test: "A get request" });

// You can very easily make POST requests/navigate to a new page with:
// dispatcher.postTo("#post/contact", { test: "A post request" });
// Read more bellow
```


## Defining routes
At this moment there exist 2 router types `get` and `post`.  The structure will look like this for them both:
```
router.get(string pattern, mixed call);
router.post(string pattern, mixed call);
```
#### Arguments
* **Pattern (string):** Expects URI path string with regular expression support.
* **Call (mixed):** Any data type (callable,  anonymous function, string, number,  bool...) is actually allow, you would tho usually want to feed it a function of sort, witch is done in the dispatcher. In my examples I will use a regular callable function.

### Routes
The routes first parameter expects  a URI path string. I really basic example would be:
```javascript
// Possible path: #about
router.get('/about', function(vars, request, path) {
});
```
You can add multiple paths.
```javascript
// Possible path: #about/contact
router.get('/about/contact', function(vars, request, path) {
});
```
### Use regular expressions 
To use regular expressions you need to enclose the pattern inside **curly brackets: {PATTERN}**. 
```javascript
// Possible path: #about/location/stockholm
router.get('/about/location/{[a-z]+}', function(vars, request, path) {
});
```

### Bind router pattern to a key
It is highly recommended to specify each URI path that you want to access with a **key**. 
```javascript
// Possible path: #about/location/stockholm
router.get('/{page:about}/location/{city:[^/]+}', function(vars, request, path) {
	//vars.page[0] is expected to be "about"
	//vars.city[0] is expected to be any string value (stockholm, denmark, new-york) from passed URI.
});
```
It is also allowed to combine a whole path to a **key**.
```javascript
// Possible path: #about/contact
router.get('/{page:about/location}', function(vars, request, path) {
	//vars.page[0] is expected to be "about"
	//vars.page[1] is expected to be "location"
});
```
### Combining pattern with keywords
```javascript
// Possible path: #articles/post-824/hello-world
router.get('/articles/{id:post-[0-9]+}/{slug:[^/]+}', function(vars, request, path) {
	//vars.id[0] is expected to be "post-824"
	//vars.slug[0] is expected to be "hello-world"
});
```

### None mandatory URI Paths.
You can add one or more, **none mandatory** URI path by enclosing path name not slash with brackets and one question mark e.g. **/(PATH_NAME)?**. 
```javascript
// Possible path: #articles
// Possible path: #articles/post-824/hello-world
router.get('/articles/({id:post-[0-9]+})?/({slug:[^/]+})?', function(vars, request, path) {
});
```
*What important to notice is that you should not enclose the **leading** slash. The leading slash will automatically be excluded from the pattern.*


## Dispatcher
The dispatcher will take routes, states and process them and the serve the matching result.
```
dispatcher.dispatcher(Router routerCollection, serverParams, callable dispatch);
```
#### Arguments
* **routerCollection (Router):** Expects a instance of Router that will serve the dispacher with a route collection to validate against.
* **serverParams:** This will be the current dynamic URI path that the dispacher will use.
* **dispatch (callable):** Expects a callable function that will serve the possible matching result.

### Router Collection 
The router collection is expecting an instance of Router. That said you could create your own router collection and extend to Router, if you know how and want to add more HTTP Methods/verbs, structure or functionality.

### Server params
As mentioned above, the server params will be the current, dynamic URI path that the dispacher will use. This means it's used to server the dispatcher with some part of URI dynamically so that when that part changes the dispacher automatically detects those changes. There comes some option out of the box that you can use.

#### URI Fragment
The URI Fragment is the URL hash or anchor without "#" character.
```javascript
dispatcher.serverParams("fragment")
```

#### URI Path
Server param path is the regular URI path.
```javascript
dispatcher.serverParams("path")
```

#### Script Path
The Script Path will work without any support browser window.history support. And could be used for for example API routes or maybe shell command routes.
```javascript
dispatcher.request("path")
```

### Dispatch
The last argument in the dispatcher method is called ”dispatch". It expects a callable function that will serve the possible matching result both success with status code 200 or error with status code 404 (page not found) and 405 (Method not allowed). The callable take 2 arguments: response (object) and statusCode (int).

#### Arguments
* **response (object):** will r

```javascript
dispatcher.dispatcher(router, dispatcher.serverParams("fragment"), function(response, statusCode) {
	response.controller(response.vars, response.request, response.path, statusCode);
});
```
### Response
A possible the response bellow could be outputted from a valid router URI pattern `"/{page:product}/{id:[0-9]+}/{slug:[^/]+}"`.

```json
{
	verb: "GET",
	status: 200,
	path: ["product", "72", "chesterfield"],
	vars: {
		page: ["product"],
		id: ["72"],
		slug: ["chesterfield"],
	},
	form: {}, // Will catch submited DOM form element
	request: {
		get: URLSearchParams,// An instance of URLSearchParams
		post: FormData, //An instance of FormData
	}
}
```
* **verb:** Is the expected HTTP method/verb (GET or POST)
* **status:** Is the expected HTTP status code (200, 404 or 405)
* **path:** Is the URI path as an array
* **vars:** Is an object with expects array path attached to an key
* **form:** Will catch submited DOM form element
* **request.get:** An instance of URLSearchParams that will catch GET Requests and query strings
* **request.post:** An instance of FormData that will catch POST Requests

