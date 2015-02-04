/**
 * Created by karl on 29/1/15.
 */

var mithrilRender = require('mithril-node-render');
var serverWindow = require('./window');

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

function pushId(arr, id) {
    arr.push(id);
    return id;
}

function removeId(arr, id, fn) {
    var index = arr.indexOf(id);
    if (index >= 0) {
        arr.splice(index, 1);
        fn(id);
    }
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
            return pushId(miso.intervals, setInterval(fn, delay));
        },
        clearInterval: function (id) {
            removeId(miso.intervals, id, clearInterval);
        },
        setTimeout: function (fn, delay) {
            return pushId(miso.timeouts, setTimeout(fn, delay));
        },
        clearTimeout: function (id) {
            removeId(miso.timeouts, id, clearTimeout);
        },
        init: function (m, mRequest) {
            miso.done = function (mRedraw, mRender, mRequest) {
                miso.timeouts.forEach(clearTimeout);
                miso.intervals.forEach(clearInterval);
                miso.startTimer = function() {};
                var misoElement = window.document.querySelector('#miso');
                if (misoElement) m.render(misoElement, 'window.miso = ' + JSON.stringify(options.initClient({
                    cache: miso.cache,
                    readyDelay: miso.readyDelay,
                    server: false,
                    verify: options.verify
                })) + ';');
                var html = mithrilRender(layout);
                m.redraw = mRedraw;
                m.render = mRender;
                m.request = mRequest;
                cb(null, html);
            };

            var renderIndex = 0;
            m.render = function (element, renderDom) {
                var attrs = element.attrs;
                if (!attrs) attrs = element.attrs || {};
                attrs['data-mr'] = attrs['data-mr'] || renderIndex++;
                element.children = markNodes(Array.isArray(renderDom) ? renderDom : [renderDom]);
                miso.startTimer();
            };

            m.request = function (options) {
                var promise = null;
                var method = options.method.toLowerCase();
                var url = options.url;
                var cache = miso.cache;
                if (cache) {
                    var methods = cache[url] || (cache[url] = {});
                    promise = methods[method];
                }
                m.startComputation();
                if (!promise) {
                    promise = methods[method] = mRequest(options);
                    promise.then(function (res) {
                        methods[method] = {err: null, res: res};
                    }, function (err) {
                        methods[method] = {err: err, res: null};
                    });
                }
                promise.then(m.endComputation, m.endComputation);
                return promise;
            };

        }
    };
    var layout = options.layout();
    var window = serverWindow(miso, serverApp, clientApp, req, layout, options);
    return window;
};