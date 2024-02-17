import { Router } from "../Router.js";
import { Dispatcher } from "../Dispatcher.js";

const router = new Router();
const dispatcher = new Dispatcher();


/*

router.get('', function() {
    console.log("START");
});

 */
/*
router.get('{page:test}(/{p1:param1/param4})?/{p2:param2}(/{id:param3})?', function() {
    console.log("TEST 1");
});


router.get('{page:test}(/{p1:param1/param4})?/{p2:param2}(/{id:param3})?', function() {
    console.log("TEST 2");
});
 */

router.get('{page:[^/]+}', function() {
    console.log("TEST 2");
});

/*
router.get('{page:test}', function() {
    console.log("TEST 3");
});

router.get('{page:www/[^/]+}/test11/{id:test22}', function() {
    console.log("ABOUT");
});
*/

dispatcher.dispatcher(router, dispatcher.serverParams("fragment"), function(data, status) {
    console.log("STATYS:", data, status);

    if(typeof data.controller === "function") {
        data.controller();
    }
});

/*
dispatcher.navigateTo("#about", {
    test: 11221
});
 */


/*

const emitter = new StateHandler(function() {
    return {
        href: (location.href ?? ""),
        path: (location.pathname ?? ""),
        query: StateHandler.parseStr(location.search ?? ""),
        hash: (location.hash ? location.hash.substring(1) : ""),
    }
});


emitter.on('popstate', function(event) {
    console.log("POPED", event.details);
});

emitter.pushState("#teet1", {
    www: 12
});


emitter.pushState("#teet3", {
    www: 13
});


 */

//window.addEventListener("popstate", emitter.popstate);

//emitter.on('foo', data => console.log(data.text));

//emitter.emit('foo', { text: 'Foo event triggered' });

