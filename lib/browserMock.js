/**
 * Created by karl on 29/1/15.
 */

var mithrilRender = require('mithril-node-render');
var windowMock = require('./windowMock');

function markNodes(node) {
    if (Array.isArray(node)) {
        node.forEach(markNodes);
    } else if (typeof node === 'object') {
        if (!node.attrs) node.attrs = {};
        node.attrs['data-mi'] = true;
        markNodes(node.children);
    }
    return node;
}

module.exports = function(serverApp, clientApp, req, options, cb) {
    var miso = {
        cache: {},
        readyDelay: options.readyDelay,
        readyTimeout: null,
        server: true,
        timeouts: [],
        intervals: [],
        setInterval: function (fn, delay) {
            var id = setInterval(fn, delay);
            miso.intervals.push(id);
            return id;
        },
        clearInterval: function (id) {
            var intervals = miso.intervals;
            var index = intervals.indexOf(id);
            if (index >= 0) intervals.splice(index, 1);
            clearInterval(id);
        },
        setTimeout: function (fn, delay) {
            var id = setTimeout(fn, delay);
            miso.timeouts.push(id);
            return id;
        },
        clearTimeout: function (id) {
            var timeouts = miso.timeouts;
            var index = timeouts.indexOf(id);
            if (index >= 0) timeouts.splice(index, 1);
            clearTimeout(id);
        },
        init: function (m, mRequest) {
            miso.done = function (m) {
                miso.timeouts.forEach(clearTimeout);
                miso.intervals.forEach(clearInterval);
                var misoElement = window.document.querySelector('#miso');
                if (misoElement) m.render(misoElement, 'miso = ' + JSON.stringify({
                    cache: miso.cache,
                    readyDelay: miso.readyDelay,
                    server: false
                }) + ';');
                cb(null, mithrilRender(winMock.cells));
            };
            miso.ready = function () {
                miso.clearTimeout(miso.readyTimeout);
                miso.readyTimeout = miso.setTimeout(function () {
                    miso.done(m);
                }, miso.readyDelay);
            };
            // jsonp support
            miso.script = function (child) {
                var query = child.src.split('?')[1];
                var params = {};
                query.split('&').forEach(function (param) {
                    param = param.split('=');
                    params[param[0]] = param[1];
                });
                var callbackKey = params.callback;
                if (/^mithril_callback_/.test(callbackKey)) {
                    var xhr = {
                        method: 'get',
                        url: child.src,
                        headers: {
                            'Content-Type': 'application/javascript'
                        },
                        data: null,
                        onreadystatechange: function () {
                            if (xhr.readyState === 4) {
                                if (xhr.status >= 200 && xhr.status < 300) {
                                    window[callbackKey](JSON.parse(xhr.responseText));
                                    child.onload({});
                                } else {
                                    child.onerror({});
                                }
                            }
                        }
                    };
                    winMock.request(xhr);
                }
            };
            var rendered = false;
            var renderIndex = 0;
            m.render = function (element, renderDom) {
                var attrs = element.attrs;
                if (!attrs) attrs = element.attrs || {};
                attrs['data-mr'] = attrs['data-mr'] || renderIndex++;
                element.children = markNodes(Array.isArray(renderDom) ? renderDom : [renderDom]);
                rendered = true;
            };
            var redraw = m.redraw;
            m.redraw = function () {
                rendered = false;
                redraw(true);
                if (rendered) miso.ready();
            };
            m.redraw.strategy = redraw.strategy;
            m.request = function (options) {
                var method = options.method.toLowerCase();
                var url = options.url;
                var cache = miso.cache;
                var methods = cache[url] || (cache[url] = {});
                var promise = methods[method];
                if (!promise) {
                    promise = methods[method] = mRequest(options);
                    promise.then(function (res) {
                        methods[method] = {err: null, res: res};
                    }, function (err) {
                        methods[method] = {err: err, res: null};
                    });
                }
                return promise;
            };
        }
    };
    var winMock = windowMock(miso, serverApp, clientApp, req, options);
    var window = winMock.window;
    return window;
};