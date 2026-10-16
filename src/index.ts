import Router from './Router.js';
import Dispatcher from './Dispatcher.js';

export { Router, Dispatcher };

// Types only: they add nothing to the JavaScript
export type {
  HttpVerb, ErrorStatus, RouteConfig, Route, ErrorRoute,
} from './Router.js';
export type {
  Dynamic, DispatcherConfig, RouteCollection, RequestFields, ServerParams, RequestState,
  DispatchStatus, MatchResult, DispatchResponse, DispatchCallback,
} from './Dispatcher.js';
// StateHandler is not exported at runtime; getStateHandler() returns one
export type {
  default as StateHandler, State, StateSource, StateHandlerConfig, StateEvent, EventHandler,
} from './StateHandler.js';
