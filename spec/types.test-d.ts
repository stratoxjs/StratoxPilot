// Type-level tests of the public API (roadmap 5.4). They are checked by tsc, never run:
// `npm test` runs them with Vitest's typecheck (tsconfig.spec.json). A `@ts-expect-error`
// line fails the test when the error it expects goes away.
import { describe, expectTypeOf, test } from 'vitest';
import { Router, Dispatcher } from '../src/index.js';
import type {
  HttpVerb, Route, DispatchResponse, DispatchStatus, DispatcherConfig, ServerParams, StateHandler,
} from '../src/index.js';
import type * as Entry from '../src/index.js';

describe('the package entry', () => {
  test('exports Router and Dispatcher; StateHandler is a type only', () => {
    expectTypeOf(Router).toBeConstructibleWith();
    expectTypeOf(Dispatcher).toBeConstructibleWith({ catchForms: true });
    expectTypeOf<typeof Entry>().not.toHaveProperty('StateHandler');
    expectTypeOf(new Dispatcher().getStateHandler()).toEqualTypeOf<StateHandler>();
  });
});

describe('Router', () => {
  test('routes keep the controller type', () => {
    type Page = () => string;
    const home: Page = () => 'home';
    const router = new Router<Page>();
    router.get('/', home);
    router.post('/contact', home, { csrf: true });
    router.map(['GET', 'POST'], '/both', home);
    router.notFound(home);
    router.error(405, home);
    expectTypeOf(router.getRouters()).toEqualTypeOf<Route<Page>[]>();
    expectTypeOf(router.getStatusError(404)).toEqualTypeOf<Page | false>();
    // @ts-expect-error the controller has the router's type
    router.get('/about', 'about');
    // @ts-expect-error only 404 and 405 have error routes
    router.error(500, home);
  });

  test('without a type, any controller', () => {
    const router = new Router();
    router.get('/', 'home');
    router.get('/about', { title: 'About' });
    expectTypeOf(router.getRouters()[0].controller).toBeUnknown();
  });

  test('isValidVerb() narrows a string to a verb', () => {
    const verb: string = 'GET';
    if (Router.isValidVerb(verb)) {
      expectTypeOf(verb).toEqualTypeOf<HttpVerb>();
    }
    expectTypeOf(Router.getValidVerbs()).toEqualTypeOf<HttpVerb[]>();
  });
});

describe('Dispatcher', () => {
  test('the dispatch callback gets the response; `this` is the dispatcher', () => {
    const router = new Router<string>();
    router.get('/{page:[^/]+}', 'page');
    const dispatcher = new Dispatcher({ catchForms: true, catchLinks: true, root: '/app' });
    dispatcher.dispatcher(router, dispatcher.serverParams('path'), function onDispatch(response, status) {
      expectTypeOf(this).toEqualTypeOf<Dispatcher>();
      expectTypeOf(response).toEqualTypeOf<DispatchResponse<string>>();
      expectTypeOf(response.controller).toEqualTypeOf<string | null>();
      expectTypeOf(response.vars).toEqualTypeOf<Record<string, string[]>>();
      expectTypeOf(response.form).toEqualTypeOf<HTMLFormElement | null>();
      expectTypeOf(status).toEqualTypeOf<DispatchStatus>();
      expectTypeOf(status).toEqualTypeOf<200 | 404 | 405>();
    });
  });

  test('server params and request fields', () => {
    const dispatcher = new Dispatcher();
    expectTypeOf(dispatcher.serverParams()).toEqualTypeOf<ServerParams>();
    expectTypeOf(dispatcher.serverParams('fragment')).toEqualTypeOf<() => unknown>();
    expectTypeOf(dispatcher.request('id')).toEqualTypeOf<() => unknown>();
    dispatcher.navigateTo('/about', { tab: 'team' });
    dispatcher.navigateTo(new URL('https://example.com/about'));
    expectTypeOf(dispatcher.postTo('/contact', new FormData())).toEqualTypeOf<Record<string, unknown> | FormData>();
  });

  test('the config', () => {
    const config: DispatcherConfig = { fragmentPrefix: '!', server: () => ({ path: '/' }) };
    expectTypeOf(config.catchForms).toEqualTypeOf<boolean | undefined>();
    // @ts-expect-error catchForms is a boolean
    new Dispatcher({ catchForms: 'yes' });
    // @ts-expect-error an unknown config key is a typo
    new Dispatcher({ catchFrom: true });
  });
});
