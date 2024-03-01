# Stratox Pilot ![npm](https://img.shields.io/npm/v/@stratox/pilot)
Startox Pilot is a JavaScript router designed for ease of use and flexibility. It employs regular expressions to offer dynamic routing, allowing for both straightforward and complex navigation paths. As a universal library, it works across different platforms without needing any external dependencies. This independence makes Startox Pilot a practical option for developers in search of a dependable routing tool that combines advanced features and modular design in a compact package.

## Documentation

#### The documentation is divided into several sections:
* [Installation](#installation)
* [A basic example](#a-basic-example)
* [Configuration Options](#configuration-options)
* [Defining routes](#defining-routes)
* [Dispatcher overview](#dispatcher-overview)
* [Navigation](#navigation) 
* [Form submission](#form-submission)
* [Have any questions](#have-any-questions)

## Installation
```javascript
npm install @stratox/pilot
```

##  A basic example
Below is a simple yet comprehensive example. Each component will be explored in further detail later in this guide.
```javascript
import { Router, Dispatcher } from '@stratox/pilot';

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
    // response.controller is equal to what the routers second argument is being fed with.
    // You can add Ajax here if you wish to trigger a ajax call.
    response.controller(response.vars, response.request, response.path, statusCode);
});
// URI HASH: dispatcher.serverParams("fragment") // Fragment is HASH without "#" character.
// URI PATH: dispatcher.serverParams("path") // Regular URI path
// SCRIPT PATH: dispatcher.request("path") // Will work without browser window.history support
```

## Configuration options
The dispatcher offers several configuration options to tailor its behavior to your application's needs.

```javascript
const dispatcher = new Dispatcher({
    catchForms: false, // Toggle form submission catching
    root: "", // Set a root directory
    fragmentPrefix: "" // Define a prefix for hash/fragment navigation
});
```

### Configuration Parameters
- **catchForms (bool):** When set to `true`, enables the dispatcher to automatically intercept and route form submissions. This feature facilitates seamless integration of form-based navigation within your application.
- **root (string):** This parameter allows you to specify a root directory using an **absolute path**. This setting is crucial for defining where simulated or "pretty" URI paths begin. The necessity of this configuration depends on your specific deployment environment.
- **fragmentPrefix (string):** This option lets you prepend a prefix to fragment or hash navigation calls. For instance, adding the "!" character means the URL's hash will be expected to appear as "#!your-hash", modifying the default behavior to accommodate specific routing schemes or to enhance compatibility with certain browsers or frameworks.

## Defining routes
In Stratox Pilot, there are two primary router types: `get` and `post`. Both types follow the same structural format, as illustrated below, with the key difference being that they will expect different request (see navigation for more information)
```
router.get(string pattern, mixed call);
router.post(string pattern, mixed call);
```
#### Arguments
* **pattern (string):** This parameter expects a URI path in the form of a string, which may include regular expressions for more complex matching criteria.
* **call (mixed):** This parameter can accept any data type, such as a callable, anonymous function, string, number, or boolean. However, it is most common to use a function. For the purposes of this guide, I use a regular callable function in my examples.

### A really Basic example
```javascript
// Possible path: #about
router.get('/about', function(vars, request, path) {
});
```
And you can of course **add multiple** paths.
```javascript
// Possible path: #about/contact
router.get('/about/contact', function(vars, request, path) {
});
```

### Using Regular Expressions
To incorporate regular expressions in routing patterns, enclose the expression within **curly brackets: `{PATTERN}`**. This syntax allows for flexible and powerful URL matching based on specified patterns.
```javascript
// Possible path: #about/location/stockholm
router.get('/about/location/{[a-z]+}', function(vars, request, path) {
});
```
### Binding Router Patterns to a Key
It is strongly advised to associate each URI path you wish to access with a specific **key**. This approach enhances the clarity and manageability of your route definitions.
```javascript
// Possible path: #about/location/stockholm
router.get('/{page:about}/location/{city:[^/]+}', function(vars, request, path) {
    //vars.page[0] is expected to be "about"
    //vars.city[0] is expected to be any string value (stockholm, denmark, new-york) from passed URI.
});
```
You can also map an entire path to a **key**, allowing for more concise and organized route management.
```javascript
// Possible path: #about/contact
router.get('/{page:about/location}', function(vars, request, path) {
    //vars.page[0] is expected to be "about"
    //vars.page[1] is expected to be "location"
});
```
### Combining pattern with keywords
Combining patterns with keywords e.g. (**post-**[0-9]+) enables you to create more expressive and versatile route definitions.
```javascript
// Possible path: #articles/post-824/hello-world
router.get('/articles/{id:post-[0-9]+}/{slug:[^/]+}', function(vars, request, path) {
    //vars.id[0] is expected to be "post-824"
    //vars.slug[0] is expected to be "hello-world"
});
```

### Handling Unlimited Nested Paths

To accommodate an unlimited number of nested paths within your routing configuration, you can utilize the pattern `".+"`. However, it's strongly advised to precede such a router pattern with a specific prefix to maintain clarity and structure, as demonstrated in the example below with the prefix `/shop`.

```javascript
// Example of accessing a single category: #shop/furniture
// Example of accessing multiple nested categories: #shop/furniture/sofas/chesterfield
router.get('/shop/{category:.+}', function(vars, request, path) {
    // Retrieves the last category segment from the path
    const category = vars.category.pop();
    console.log(`The current category is: ${category}`);
});
```

This approach allows for the dynamic handling of deeply nested routes under a common parent path, offering flexibility in how URLs are structured and processed.

### Optional URI Paths
To define one or more optional URI paths, enclose the path segment (excluding the slash) in brackets followed by a question mark, for example: **/(PATH_NAME)?**. This syntax allows for flexibility in route matching by making certain path segments non-mandatory.
```javascript
// Possible path: #articles
// Possible path: #articles/post-824/hello-world
router.get('/articles/({id:post-[0-9]+})?/({slug:[^/]+})?', function(vars, request, path) {
});
```
It's important to note that you should not enclose the **leading slash** in brackets. The leading slash is automatically excluded from the pattern, ensuring the correct interpretation of the route.

### Catch status errors
There is an optional and special router pattern that let's you catch HTTP Status Errors with in a router.
```javascript
router.get('[STATUS_ERROR]', function(vars, request, path, statusCode) {
    if(statusCode === 404) {
        console.log("404 Page not found", statusCode);
    } else {
        console.log("405 Method not allowed", statusCode);
    }
});
```

## Dispatcher overview

The dispatcher is essential for identifying and providing the appropriate route from the state handler. Designed for flexibility, it enables the incorporation of custom logic, such as AJAX, to tailor functionality to specific needs.

```javascript
dispatcher.dispatcher(Router routerCollection, serverParams, callable dispatch);
```

#### Arguments
* **[routerCollection](#router-collection-routercollection)** 
* **[serverParams](#server-params-serverparams)** 
* **[dispatch](#dispatch-function-dispatch)**

### Router Collection (routerCollection)
This expects a Router instance, allowing for customization. You can create your router collection extending the Router class, potentially adding more HTTP methods, structure, or functionality.

### Server Params (serverParams)
Server params indicate the URL segment the dispatcher should utilize. These params dynamically target the specified URI segment. Several built-in options include:

#### URI Fragment
Represents the URL hash or anchor minus the "#" character.
```javascript
dispatcher.serverParams("fragment");
```

#### URI Path
The regular URI path segment.
```javascript
dispatcher.serverParams("path");
```

#### Script Path
Ideal for non-browser environments, supporting backend applications, APIs, or shell command routes.
```javascript
dispatcher.request("path");
```

### Dispatch Function (dispatch)
The "dispatch" argument expects a callable function to process the match result, handling both successful (status code 200) and error outcomes (status code 404 for "page not found" and 405 for "Method not allowed"). The function receives two parameters: response (object) and statusCode (int).

#### Response Details
- **response (object):** Provides an object with vital response data.
- **statusCode (int):** Indicates the result, either successful (200) or error (404 or 405).

### Basic Dispatcher Example
Below is an excerpt from the example at the start of the guide:
```javascript
dispatcher.dispatcher(router, dispatcher.serverParams("fragment"), function(response, statusCode) {
    response.controller(response.vars, response.request, response.path, statusCode);
});
```

### Understanding the Response
The response structure, as illustrated with the router pattern `"/{page:product}/{id:[0-9]+}/{slug:[^/]+}"`, and URI path **/product/72/chesterfield** includes:

```json
{
    "verb": "GET",
    "status": 200,
    "path": ["product", "72", "chesterfield"],
    "vars": {
        "page": "product",
        "id": "72",
        "slug": "chesterfield"
    },
    "form": {},
    "request": {
        "get": "URLSearchParams",
        "post": "FormData"
    }
}
```
- **verb:** The HTTP method (GET or POST).
- **status:** The HTTP status code (200, 404, or 405).
- **path:** The URI path as an array.
- **vars:** An object mapping path segments to keys.
- **form:** Captures submitted DOM form elements.
- **request.get:** An instance of URLSearchParams for GET requests.
- **request.post:** An instance of FormData for POST requests.

## Navigation

The library provides intuitive navigation options to seamlessly transition between pages and initiate GET or POST requests.

### Page Navigation / GET Request

Initiating a GET request or navigating to a new page is straightforward. Such actions will correspond to a `get` router, with the request parameter converting into an instance of URLSearchParams for the request.
#### Arguments
- **path (string):** Specifies the URI, which can be a **regular path** or a **hash**.
- **request (object):** Sends a GET request or query string to the dispatcher. This will be transformed into an instance of [URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams). When executed in a browser, the query string will also be appended to the URL in the address field.

#### Make get request
```javascript
// URI hash (fragment with hashtag) navigation
dispatcher.navigateTo("#articles/824/hello-world", { test: "A get request" });

// URI path navigation
// dispatcher.navigateTo("/articles/824/hello-world", { test: "A get request" });
```

#### The navigation result
The above navigation will trigger the result for the matching router:
```javascript
// GET: example.se/?test=A+get+request#articles/824/hello-world
router.get('/articles/{id:[0-9]+}/{slug:[^/]+}', function(vars, request, path) {
    const id = vars.id.pop();
    const slug = vars.slug.pop();
    const test = request.get.get("test"); // Get the query string/get request "test"
    console.log(`Article ID: ${id}, Slug: ${slug} and GET Request ${test}.`);
});
```

### POST Request

Creating a POST request is similarly efficient, targeting a `post` router. The request parameter will be converted into an instance of FormData to facilitate the request.
#### Arguments
- **path (string):** Defines the URI, which can be a **regular path** or a **hash**.
- **request (object):** Submits a POST request to the dispatcher. This will be processed into an instance of [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData), allowing for detailed and structured data transmission.

#### Make post request
```javascript
dispatcher.postTo("#post/contact", { firstname: "John", lastname: "Doe" });
```
#### The post request result
The above post will trigger the result for the matching router:
```javascript
// POST: example.se/#post/contact
router.post('/post/contact', function(vars, request, path) {
    const firstname = request.post.get("firstname");
    const lastname = request.post.get("lastname");
    console.log(`The post request, first name: ${firstname}, last name: ${lastname}`);
});
```

## Form submission

Stratox Pilot supports automatic form submission handling through routers, a feature that must be explicitly enabled in the Dispatcher's configuration.

### 1. Enable Form Submission
To allow automatic catching and routing of form submissions, enable the `catchForms` option in the Dispatcher configuration:

```javascript
const dispatcher = new Dispatcher({
    catchForms: true
});
```

### 2. Define Routes
Next, define the routes that will handle form submissions. For example, to handle a POST request:

```javascript
// POST: example.se/#post/contact
router.post('/post/contact', function(vars, request, path) {
    console.log('Contact form posted with form request:', request.post);
});
```

### 3. Implement Form Submission
Forms can use both GET and POST methods. Below is an example of a form designed to submit via POST:

```html
<form action="#post/contact" method="post">
    <div>
        <label>First name</label>
        <input type="text" name="firstname" value="">
    </div>
    <div>
        <label>Last name</label>
        <input type="text" name="lastname" value="">
    </div>
    <div>
        <label>E-mail</label>
        <input type="email" name="email" value="">
    </div>
    <input type="submit" name="submit" value="Send">
</form>
```

With these settings, the dispatcher will automatically capture and route submissions to the corresponding handler if a matching route is found.

## Have any questions
If there's anything unclear or you have further questions, feel free to reach out via email at daniel.ronkainen@wazabii.se.
