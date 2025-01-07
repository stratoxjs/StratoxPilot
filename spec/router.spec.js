import Router from '../src/Router';
import Dispatcher from '../src/Dispatcher';

const router = new Router();
const dispatcher = new Dispatcher();

// Init routes
router.get('/', true);
router.get('/{type:a}/{page:test}/{id:[0-9]+}', true);
router.get('/{type:a}/{page:test}/{id:[a-z]+}', true);
router.get('/{type:b}/{page:.+}', true);
router.get('/{type:c}/{page:[^/]+}/test2', true);
router.post('/{type:d}/{page:contact}', true);

// Dispatching the triggerd tests
dispatcher.dispatcher(router, dispatcher.request('path'), (data, status) => {
  describe(`Validating router with path (${data.path.join('/')}):`, () => {
    it('Checking data types', () => {
      expect(typeof data.verb).toBe('string');
      expect(typeof data.status).toBe('number');
      expect(typeof data.path).toBe('object');
      expect(typeof data.vars).toBe('object');
      expect(typeof data.request).toBe('object');
    });

    it('Expects status 200', () => {
      expect(status).toBe(200);
    });

    it('Has controller', () => {
      expect(data.controller).toBe(true);
    });

    // Ignore start page
    if (data.path.length > 0) {
      if (data.verb === 'POST') {
        it('Validating POST request', () => {
          expect(typeof data.request.post === 'object').toBe(true);
        });

        it('POST request param', () => {
          expect(data.request.post.param).toBe(10);
        });
      } else {
        it('Validating GET request', () => {
          expect(data.request.get instanceof URLSearchParams).toBe(true);
        });

        it('Get request param', () => {
          expect(data.request.get.get('param')).toBe('10');
        });
      }

      it('Check vars type is in place', () => {
        expect(typeof data.vars.type[0]).toBe('string');
      });

      if (data.vars.type[0] === 'b') {
        it('Check page vars length', () => {
          expect(data.vars.page.length).toBe(3);
        });
      }
    }
  });
});

// Trigger tests
dispatcher.navigateTo('/a/test/12', { param: 10 });
dispatcher.navigateTo('/a/test/ab', { param: 10 });
dispatcher.navigateTo('/b/test/test2/test3', { param: 10 });
dispatcher.navigateTo('/c/test/test2', { param: 10 });
dispatcher.postTo('/d/contact', { param: 10 });
