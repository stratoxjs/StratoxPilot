import { Router, Dispatcher } from 'https://cdn.jsdelivr.net/npm/@stratox/pilot@1.0.1/src/index.js';

const router = new Router();
const dispatcher = new Dispatcher();

window.addEventListener('DOMContentLoaded', () => {
  const content = document.getElementById('content');

  // GET: example.se/
  router.get('/', () => {
    content.innerText = 'Start page';
  });

  // GET: example.se/#about (REGULAR URI paths e.g. "example.se/about" is also of course supported!)
  router.get('/about', (vars, request, path) => {
    const page = vars[0].pop();
    content.innerText = `The current page is: ${page}`;
  });

  router.get('/shop/{category:.+}', (vars, request, path) => {
    const category = vars.category.pop();
    content.innerText = `The current category is: ${category}`;
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

  // Navigate page
  const navToBtn = document.querySelectorAll('.nav-to-btn');
  navToBtn.forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const href = e.target.getAttribute('href');
      dispatcher.navigateTo(href);
    });
  });
});
