import { Router } from "../src/Router.js";
import { Dispatcher } from "../src/Dispatcher.js";



/*

global.document = {
    addEventListener: (event, handler) => {
        // Mock functionality or log for testing purposes
        console.log(`Mock addEventListener called with: ${event}`);
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
        console.log(`Mock pushState called with url: ${url}`);
    },
    replaceState: (state, title, url) => {
        console.log(`Mock replaceState called with url: ${url}`);
    },
    go: (num) => {
        console.log(`Mock history go called with num: ${num}`);
    }
};

global.location = {
    href: 'http://example.com',
    pathname: '/test/test2',
    search: 'id=862&slug=lorem',
    hash: '#test/test2',
    assign: (url) => {
        console.log(`Mock location assign called with url: ${url}`);
    }
};


const router = new Router();
const dispatcher = new Dispatcher();




describe("Your test suite", function() {

    beforeEach(function() {
        router.get("test/test2", "string");
    });

    it("Dispatch", function() {
        dispatcher.dispatcher(router, function(response, status) {

            console.log("www", response, status);

        });
        expect(true).toBe(true);
    });
});

 */



/*
describe("Check allowd verb list", function() {

    //const verbList = ["GET", "PUT"];
    const verbList = Router.getValidVerbs();
    beforeEach(function() {
        this.isValidVerbs = true;
        for(let i = 0; i < verbList.length; i++) {
            this.isValidVerbs = Router.isValidVerb(verbList[i]);
        }

    });

    it("There is a VERB that has not been added to the validate list", function() {
        expect(verbList).toEqual(jasmine.arrayContaining(Router.getValidVerbs()));
    });

});

 */

