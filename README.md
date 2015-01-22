# mithril-iso

Experimental module that implements isomorphic mithril, that is, the client mithril app is used to render
html on a nodejs express server. The module consists of a browserify plugin and express middleware.

* The browserify plugin wraps the browserify bundle into a function. When this function is called, a new instance of the
 entire client app is created.
* On every request, the middleware configures a window object with req.url and instantiates a new client app
 using the window object. When the app calls m.ready, mithril-node-render converts the rendered page into a html string,
 which is used as response.

## How does it work

The rendering is implemented by

* adding a m.ready() method that the client app must call to indicate that the page has been fully rendered.
* implementing m.render(el, dom) as el.children = dom.
* providing a minimal window and document mock. Just enough to enable the mithril router and m.render.
 (note that the user can extend the window and document mock).

Following document methods are implemented by the mock:

* querySelector
* querySelectorAll
* getElementById
* getElementsByTagName
* getElementsByClassName
* getElementsById

These methods are implemented with mithril-query, which queries the mithril dom representation.

## Notes

To keep things simple and fast, the mithril dom representation is used instead of a full dom implementation.
This means that:

* all dom elements should be created and manipulated using the mithril methodology
* config methods are not be executed
