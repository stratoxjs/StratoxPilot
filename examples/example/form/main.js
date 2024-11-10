import { Router, Dispatcher } from 'https://cdn.jsdelivr.net/npm/@stratox/pilot@1.0.3/src/index.js';

const router = new Router();
const dispatcher = new Dispatcher({
  catchForms: true,
});

window.addEventListener('DOMContentLoaded', () => {
  const content = document.getElementById('content');

  // GET: example.se/
  router.get('/', () => {
    content.innerText = 'Waiting for form request';
  });

  router.get('/post/{form:[^/]+}', (vars, request, path) => {
    content.innerText = 'Waiting for form request';
  });

  router.post('/post/{form:[^/]+}', (vars, request, path) => {
    const postData = Object.fromEntries(request.post.entries());
    content.innerText = JSON.stringify(postData);
  });

  // Will catch 404 and 405 HTTP Status Errors codes
  // Not required you can also handle it directly in the dispatcher
  router.get('[STATUS_ERROR]', (vars, request, path, statusCode) => {
    if (statusCode === 404) {
      content.innerText = '404 Page not found';
    } else {
      content.innerText = '405 Method not allowed';
    }
  });

  // Dispatch result
  dispatcher.dispatcher(router, dispatcher.serverParams('fragment'), (response, statusCode) => {
    // Load router controller
    response.controller(response.vars, response.request, response.path, statusCode);
  });
});
