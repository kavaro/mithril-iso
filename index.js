/**
 * Created by karl on 15/1/15.
 */

var mithrilQuery = require('mithril-query');
var mithrilRender = require('mithril-node-render');
var through = require('through2');
var Promise = require('bluebird');
var extend = require('node.extend');
var fs = require('fs-extra-promise');

var noop = function () {
};

exports.render = function(url, app, options, cb) {
    var dom = options.layout;
    var queryDom = null;

    function find(selector) {
        if (!queryDom) queryDom = mithrilQuery(dom);
        return queryDom.find(selector);
    }

    function setLocation(location, url) {
        location.pathname = url;
        var index = url.indexOf('?');
        location.search = index >= 0 ? url.slice(index) : '';
        index = url.indexOf('#');
        location.hash = index >= 0 ? url.slice(index) : '';
    }

    var document = {
        querySelector: function (selector) {
            var els = find(selector);
            return (els.length) ? els[0] : null;
        },
        querySelectorAll: function (selector) {
            return find(selector);
        },
        getElementsByTagName: function (tag) {
            return document.querySelectorAll(tag);
        },
        getElementsByClassName: function (className) {
            return document.querySelectorAll('.' + className);
        },
        getElementById: function (id) {
            return document.querySelector('#' + id);
        }
    };
    var window = extend(true, {
        document: document,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        location: {
            search: '',
            hash: '',
            pathname: ''
        },
        history: {
            pushState: function (data, title, url) {
                setLocation(window.location, url);
            },
            replaceState: function (data, title, url) {
                setLocation(window.location, url);
            }
        },
        scrollTo: noop,
        server: function (m) {
            var readyTimeout = null;
            m.render = function (element, renderDom) {
                element.children = Array.isArray(renderDom) ? renderDom : [renderDom];
            };
            m.ready = function (err) {
                clearTimeout(readyTimeout);
                if (err) return cb(err);
                readyTimeout = setTimeout(function() {
                    cb(null, mithrilRender(dom));
                }, options.readyDelay);
            };
        }
    }, options.window);
    setLocation(window.location, url);
    try {
        app(window, window.document, null);
    } catch (err) {
        cb(err);
    }
}

exports.browserify = function(b, options) {
    exports.setApp(options.id, new Promise(function(resolve, reject) {
        var clientCode = '';
        b.pipeline.get('wrap').push(through.obj(function(chunk, enc, callback) {
            clientCode += chunk.toString();
            this.push(chunk);
            callback();
        }, function(nxt) {
            resolve(exports.createAppFn(clientCode));
            nxt();
        }));
    }));
}

exports.createAppFn = function(clientCode) {
    return new Function('window', 'document', 'm', 'return ' + clientCode);
};

exports.createAppFromFile = function(id, filename) {
    exports.setApp(id, fs.readFileAsync(filename, 'utf-8').then(exports.createAppFn));
};

var apps = {};

exports.setApp = function(id, app) {
    apps[id] = app;
}

exports.getApp = function(id) {
    return apps[id];
}

exports.middleware = function (clientApp, options) {
    options = extend(true, {
        cache: true,
        readyDelay: 0,
        layout: { tag: 'html', attrs: {}, children: []}
    }, options);
    return function (req, res, nxt) {
        var id = options.id;
        if (!exports.getApp(id) || !options.cache) {
            clientApp();
        }
        if (!exports.getApp(id)) {
            nxt(new Error('Browserify build does not use exports plugin'));
        } else {
            exports.getApp(id).then(function(miso) {
                exports.render(req.url, miso, options, function (err, html) {
                    err ? nxt(err) : res.end(html);
                });
            });
        }
    }
};
