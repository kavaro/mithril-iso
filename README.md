# mithril-iso

Module that implements isomorphic mithril:

* A node express server renders the mithril app on the server and sends the resulting html to the browser
* The html rendered on the server is revived on the browser by translating it into a mithril vDom cache,
  assigning event handlers and calling config functions
* The mithril api is extended with a m.iso property, which is a promise that will be:
    - resolved when the html has been successfully revived on the browser, that is, it serves as a mithril-iso
      dom ready event.
    - rejected when the html could not be revived, providing the app a means to recover.
* The server sends the html to the browser and the browser triggers the m.iso promise after the app has become idle,
  that is, when there have not been active requests and redraws during a configurable period of time.
* The goal is to support all mithril features:
    * m.start/endComputation, that is, the auto-redraw mechanism
    * m.route allows to re-use the same router on client and server.
    * m.request (XMLHttpRequest and jsonp) is intercepted on the server.
      Cross origin (jsonp only) requests are delegated to the node 'request'
      module, that is, an additional http request is made to retrieve the data.
      Same origin requests are directly translated into their corresponding express request and response objects
      and immediately pushed into the express middleware stack, that is, no additional http request is performed.
    * On the server and while reviving the html on the browser, request's are never executed in the background
      to minimize the number of redraws and improve performance.
    * On the server, a cache with all m.request responses is send to the browser to eliminate unnecessary network delays
      while reviving the html on the browser.

# Status

This module is a prototype. It has been tested on a small example app. No other tests have been defined.

# Implementation aspects

To keep the implementation simple and fast, the mithril vDom representation (as returned by the m function)
is used during server side rendering. This has a number of consequences:

* querySelector, querySelectorAll, getElementById, getElementsByTagName and getElementsByClassName are implemented
  by the mithril-query module. See mithril-query for the supported selectors. Only selectors supported by both
  mithril-query and the browser can be used.
* On the server and until the html has been revived on the browser, that is, before m.iso has been resolved,
  all DOM manipulation should be performed through the mithril api (m.render, m.redraw, m.module).
  Note that config functions are allowed to perform dom manipulation because they are only executed after the
  html has been revived. For most mithril apps this is assumed not to be a problem as they are supposed
  to be self-contained and their data shouldn't be tied to the DOM like in typical jQuery based code.
  If your app does require DOM manipulation outside of mithril, then mithril-iso is not the right solution.
* On the server and while reviving the html, requests are not executed in the background to improve performance.
* mithril-iso requires access to some of the Mithril internals to perform its tasks. To provide access to the mithril
  protected variables and function a self executing javascript function is inserted inside the mithril core with the
  help of the node mithril-parse module, effectively extending the mithrils core. The new mithril can be accessed
  with the library method or saved to a file with the save method.

# Usage

## Getting started

Create an express app.
For a full isomorphic experience, mithril-express will be used as the express template engine.

```
express myapp
cd myapp
npm install mithril-iso mithril-express browserify escape-html --save
```

Create/modify the following files:

```
// FILE: ./app.js => express server

var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mithrilExpress = require('mithril-express');
var mithrilIso = require('mithril-iso/server');

var app = express();

// mithril view engine setup
app.engine('js', mithrilExpress);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'js');

// setup middleware
app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());

// the default mithril-iso middleware generates a browserify bundle of the app in ./public/index.js
app.use(express.static(path.join(__dirname, 'public')));

// serves the mithril app on the server (the app acts as a router if m.route is used in the app).
// this example uses the default middelware options which:
// - builds the app with browserify: the ./src/browser.js entry module is bundled into ./public/index.js
// - renders app with default layout, which contains the following:
//      - in the head tag
//          - <link href="/index.css">: loads the app styles (to be defined by user)
//      - in the body tag
//          - <div id="page"></div>: this is where the page will be rendered
//          - <script id="miso"></script>: inline script with code generate by server side rendering (request cache)
//          - <script src="/index.js">: loads the app source code (browserify output)
app.use(mithrilIso.middleware(/*optional options object*/));

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        err.status = err.status || 500;
        res.status(err.status);
        // render mithril error view
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    err.status = err.status || 500;
    res.status(err.status);
    // render mithril error view
    res.render('error', {
        message: err.message,
        error: {}
    });
});

module.exports = app;
```

```
// FILE: ./views/error.js => mithril-express view used by server to report errors

var m = require('mithril-iso');
var escape = require('escape-html');

module.exports = function(ctrl) {
    var err = ctrl.error;
    return m('html', [
        m('body', [
            m('h1', escape(ctrl.message)),
            m('h2', err.hasOwnProperty('status') ? 'Error code: ' + err.status : ''),
            m('pre', escape(err.stack) || '')
        ])
    ]);
};
```

```
// FILE: ./src/browser.js => entry module of mithril app

var m = require('mithril-iso');

m.iso.then(function(cache) {
    // html has been revived sucessfully, the DOM is ready
    console.log('success:', cache);
}, function(e) {
    // an error occured while reviving the html
    console.error(e);
    // force a redraw of the app
    m.startComputation();
    m.endComputation();
});

m.route.mode = 'pathname';
m.route(document.querySelector('#page'), '/error', require('./routes'));

```

Now, define mithril routes for your app in ./src/routes.js
Finally, start the server (npm start) and navigate your browser to localhost:3000.
You should now see the success message in the browsers console.

## Express middleware

Mithril-iso provides express middleware that implements server side rendering.
The middleware can, optionally, be configured with the following options object:

* layout: function(options)
  A mithril view function that returns the layout of the app.
  The default layout is defined in mithrilIso.defaults.layout as:

```
      function (options) {
            return m('html', [
                    m('head', [
                        m('link', {
                            href: '/index.css',
                            rel: 'stylesheet',
                            type: 'text/css'
                        })
                    ]),
                    m('body', [
                        m('#page'),
                        m('script#miso'),
                        m('script', {
                            src: '/index.js'
                        })
                    ])
                ]
            );
      }
```
* build: function(options, onerror) {} (default: browserify build that bundles src/browser.js into public/index.js
  A function that the middleware calls to build the client application. This function must call the
  mithrilIso.setApp(options.id, promise) method. The promise must resolve to a string that contains the
  source code of the client app or reject to a build error. The default build function
  bundles the module located at mithrilIso.defaults.src (default: src/browser.js) to a file located at
  mithrilIso.defaults.dst (default: public/index.js) using browserify. When a build error occurs, the build
  function must call the onerror callback. The options argument of the build function is the same as the middleware
  options object.
* readyDelay: integer (default: 0)
  When the app is idle (no active requests/redraws) for readyDelay milliseconds then:
    * the server will send the html to the browser
    * the browser will trigger m.iso.
* crossOrigin: boolean or array of regexp (default: true)
  During server side rendering, the client app can make cross origin jsonp request.
  Set crossOrigin to true when any cross origin requests is allowed. For more fine grained control,
  define an crossOrigin array. Only urls that match this array will be allowed.
* production: boolean (default: app.get('env') !== 'development')
  When false, the client app is rebuild (see options.build) whenever the middleware executes.
  When true, the client app is recompiled on the first invocation only.
* cache: object (default: {})
  Object in which the response of every server side m.request is stored.
  This cache is send to the browser inside the generated html.
* id: string (default: 'app')
  Unique name for the the app. Can be used if the same middleware is used to server multiple apps.
* frameBudget: integer (default: 16)
  On the server, requestAnimationFrame and cancelAnimationFrame are simulated with a timer.
  frameBudget is the time in milliseconds between frames.
* verify: boolean (default: false)
  When true, the browser will, after reviving the html, render the app to ensure the cache is 100% in sync
  with the html. This additional rendering step can be usefull to debug the revival algorithm.
* initClient: function(miso) (default: function(miso) { return miso; }
  After server side rendering, a client configuration object is serialized into the html.
  This function allows to modify this configuration object before serialization.
* initRoute: function(reqOptions, nxt) (default: function(reqOptions, nxt) { nxt(reqoptions); })
  Before servicing a request, the initRoute callback is called. This function allows the server to modify a request
  or implement a custom request handler for certain urls. The reqOptions object contains the following properties:
    * url: full url, including protocol and hostname
    * xhr: the xhr object
    * isJsonp: boolean, true when the request is a jsonp request
    * isCrossOrigin: boolean, true when it is a crossOrigin request
    * req: the req object that requested server side rendering of the page (Note, this is not the xhr req)
* initCrossOriginReq: function(request, xhr) (default: function(request, xhr) { return request; }
  To initiate a cross origin request, a request object is created for the node 'request' module.
  This function allows to modify the request object before it is passed to the 'request' module.
* initReq: function(request, xhr) (default: function(request, xhr) { return request; }
  To initiate a same origin request an express request object is created.
  This function allows to modify the request object before it is passed to express.
* initRes: function(response, xhr) (default: function(response, xhr) { return response; }
  To initiate a same origin request an express response object is created.
  This function allows to modify the response object before it is passed to express.
* initSocket: function(socket, connection) (default: function(socket, connection) { return socket; }
  To initiate a same origin request an express request object is created. This request object needs a
  socket object. This function allows to modify the socket object before it is assigned to the request object.
* initDocument: function(document) (default: function(document) { return document; })
  On the server a document object is created for server side rendering. This function allows to extend the
  document object.
* initWindow: function(window) (default: function(window) { return window; }
  On the server a window object is created for server side rendering. This function allows to extend the
  window object.

## Browserify plugin

The default build function uses a browserify plugin which also can be used in custom build functions.
The browserify plugin, which can be accessed at mithrilIso.browserifyPlugin, saves the
bundle into a string and resolves the promise that it returns with the string.

