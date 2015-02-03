/**
 * Created by karl on 15/1/15.
 */

var prequire = require('parent-require');
var through = require('through2');
var Promise = require('bluebird');
var extend = require('node.extend');
var path = require('path');
var fs = require('fs-extra-promise');
var serverMiso = require('./lib/server/miso');
var mithrilParse = require('mithril-parse');
var m = require('mithril');

var apps = {};

exports.library = function (mithrilPath) {
    var mithril = mithrilParse.load(mithrilPath);
    var clientMiso = require('./lib/client/miso');
    return mithril.pre + clientMiso + mithril.post;
};

exports.save = function (dstPath, mithrilPath) {
    fs.writeFileSync(dstPath, exports.library(mithrilPath));
};

exports.use = function (mithrilPath) {
    m = require(mithrilPath);
    exports.save(path.join(__dirname, 'browser.js'), mithrilPath);
};

exports.use(require.resolve('mithril'));

exports.render = function (serverApp, clientApp, req, options, cb) {
    var window = serverMiso(serverApp, clientApp, req, options, cb);
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

exports.browserifyPlugin = function (b, options) {
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

function initFn(v) {
    return v;
}

exports.defaults = {
    srcPath: 'src',
    dstPath: 'public',
    src: 'browser.js',
    dst: 'index.js',
    css: 'index.css',
    build: function (buildOptions) {
        var browserify = prequire('browserify'); // peer dependency
        var defaults = exports.defaults;
        buildOptions = extend({
            src: path.resolve(defaults.srcPath, defaults.src),
            dst: path.resolve(defaults.dstPath, defaults.dst)
        }, buildOptions);
        return function (options, onerror) {
            var b = browserify();
            b.plugin(exports.browserifyPlugin, options);
            b.add(buildOptions.src);
            b.bundle()
                .on('error', function (err) {
                    this.emit('end');
                    onerror(err);
                })
                .pipe(fs.createWriteStream(buildOptions.dst))
        }
    },
    layout: function () {
        var defaults = exports.defaults;
        return m('html', [
                m('head', [
                    m('link', {
                        href: '/' + defaults.css,
                        rel: 'stylesheet',
                        type: 'text/css'
                    })
                ]),
                m('body', [
                    m('#page'),
                    m('script#miso'),
                    m('script', {
                        src: '/' + defaults.dst
                    })
                ])
            ]
        );
    }
};


exports.middleware = function (options) {
    var defaults = exports.defaults;
    options = extend({
        id: 'app',
        cache: {},
        readyDelay: 0,
        verify: false,
        frameBudget: 16,
        crossOrigin: true,
        initCrossOrigin: initFn,
        initReq: initFn,
        initRes: initFn,
        initSocket: initFn,
        initDocument: initFn,
        initWindow: initFn,
        build: defaults.build(),
        layout: defaults.layout
    }, options);
    return function (req, res, nxt) {
        var serverApp = req.app;
        var build = options.build;
        var id = options.id;
        if (!options.hasOwnProperty('production')) options.production = serverApp.get('env') !== 'development';
        if (!exports.getApp(id) || !options.production) {
            build(options, function (err) {
                console.error('MITHRIL-ISO BUILD ERROR: ' + err.message);
                nxt(err);
            });
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
