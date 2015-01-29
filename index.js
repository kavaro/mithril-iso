/**
 * Created by karl on 15/1/15.
 */

var through = require('through2');
var Promise = require('bluebird');
var extend = require('node.extend');
var fs = require('fs-extra-promise');
var browserMock = require('./lib/browserMock');

var apps = {};

exports.render = function (serverApp, clientApp, req, options, cb) {
    var window = browserMock(serverApp, clientApp, req, options, cb);
    try {
        clientApp(
            window,
            window.document,
            window.setTimeout,
            window.clearTimeout,
            window.setInterval,
            window.clearInterval
        );
    } catch (err) {
        cb(err);
    }
};

exports.browserify = function (b, options) {
    exports.setApp(options.id, new Promise(function (resolve, reject) {
        var clientCode = '';
        b.pipeline.get('wrap').push(through.obj(function (chunk, enc, callback) {
            clientCode += chunk.toString();
            this.push(chunk);
            callback();
        }, function (nxt) {
            resolve(exports.createAppFn(clientCode));
            nxt();
        }));
    }));
};

exports.createAppFn = function (clientCode) {
    return new Function('window', 'document', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'return ' + clientCode);
};

exports.setApp = function (id, app) {
    if (typeof app === 'string') app = fs.readFileAsync(filename, 'utf-8').then(exports.createAppFn);
    apps[id] = app;
};

exports.getApp = function (id) {
    return apps[id];
};

exports.middleware = function (serverApp, clientApp, options) {
    options = extend(true, {
        cache: true,
        readyDelay: 0,
        layout: {tag: 'html', attrs: {}, children: []}
    }, options);
    return function (req, res, nxt) {
        var id = options.id;
        if (!exports.getApp(id) || !options.cache) {
            clientApp(options);
        }
        if (!exports.getApp(id)) {
            nxt(new Error('mithril-iso app has not been set'));
        } else {
            exports.getApp(id).then(function (clientApp) {
                exports.render(serverApp, clientApp, req, options, function (err, html) {
                    err ? nxt(err) : res.end(html);
                });
            });
        }
    }
};
