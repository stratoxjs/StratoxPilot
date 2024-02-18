import { Router } from "../src/Router.js";
import { Dispatcher } from "../src/Dispatcher.js";

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
dispatcher.dispatcher(router, dispatcher.request("path"), function(data, status) {
    describe("Validating router with path ("+data.path.join("/")+"):", function() {

        it("Checking data types", function() {
            expect(typeof data.verb).toBe("string");
            expect(typeof data.status).toBe("number");
            expect(typeof data.path).toBe("object");
            expect(typeof data.vars).toBe("object");
            expect(typeof data.request).toBe("object");
        });

        it("Expects status 200", function() {
            expect(status).toBe(200);
        });

        it("Has controller", function() {
            expect(data.controller).toBe(true);
        });

        // Ignore start page
        if(data.path.length > 0) {

            if(data.verb === "POST") {
                it("Validating POST request", function() {
                    expect(data.request.post instanceof FormData).toBe(true);
                });

                it("POST request param", function() {
                    expect(data.request.post.get("param")).toBe('10');
                });

            } else {
                it("Validating GET request", function() {
                    expect(data.request.get instanceof URLSearchParams).toBe(true);
                });

                it("Get request param", function() {
                    expect(data.request.get.get("param")).toBe('10');
                });
            }

            it("Check vars type is in place", function() {
                expect(typeof data.vars.type[0]).toBe("string");
            });

            if(data.vars.type[0] === "b") {
                it("Check page vars length", function() {
                    expect(data.vars.page.length).toBe(3);
                });
            }
        }
    });
});


// Trigger tests
dispatcher.navigateTo("/a/test/12", { param: 10 });
dispatcher.navigateTo("/a/test/ab", { param: 10 });
dispatcher.navigateTo("/b/test/test2/test3", { param: 10 });
dispatcher.navigateTo("/c/test/test2", { param: 10 });
dispatcher.postTo("/d/contact", { param: 10 });

