/**
 * Created by karl on 25/1/15.
 */

function toString(fn) {
    return fn.toString().replace(/^function anonymous\(/, 'function (');
}

function prop(variable) {
    return toString(function () {
        if (arguments.length) $VARIABLE = arguments[0];
        return $VARIABLE;
    }).replace(/\$VARIABLE/g, variable);
}

var args = [
    'm',
    'type',
    'OBJECT',
    'ARRAY',
    'STRING',
    'FUNCTION',
    'window.miso || {}',
    'autoredraw',
    'nodeCache',
    'cellCache',
    prop('redraw'),
    prop('pendingRequests')
];

var clientMiso = function (m, type, OBJECT, ARRAY, STRING, FUNCTION, miso, autoredraw, nodeCache, cellCache, redrawProp, pendingRequestsProp) {
    var end = m.deferred();
    var TEXT_NODE = 3;

    function filterChildNodes(element) {
        var nodes = element.childNodes;
        var isoNodes = [];
        for (var i = 0, l = nodes.length; i < l; i++) {
            var node = nodes[i];
            if (node.nodeType === TEXT_NODE || (node.hasAttribute && node.hasAttribute('data-mi'))) isoNodes.push(node);
        }
        return isoNodes;
    }

    function reviveAttributes(node, data, cached, configs) {
        var dataAttrs = data.attrs || {};
        for (var attrName in dataAttrs) {
            var dataAttr = dataAttrs[attrName];
            try {
                if (attrName === "config" && type.call(dataAttr) === FUNCTION) {
                    var context = cached.configContext = {};
                    var callback = function (dataAttr, args) {
                        return function () {
                            return dataAttr.apply(dataAttr, args)
                        }
                    };
                    configs.push(callback(dataAttr, [node, true, context, cached]))
                } else if (typeof dataAttr === FUNCTION && attrName.indexOf("on") === 0) {
                    // attach temporary event handler, mithril diff algorithm will replace with final event handler on first redraw
                    node[attrName] = autoredraw(dataAttr, node);
                }
            } catch (e) {
                if (e.message.indexOf("Invalid argument") < 0) throw e
            }
        }
    }

    function reviveNode(node, data, configs) {
        if (!node) throw new Error('Unable to revive: ' + JSON.stringify(data));
        if (data == null || data.toString() == null) data = "";
        if (data.subtree === "retain") delete data.subtree;
        var dataType = type.call(data);
        var cached = new data.constructor;
        if (cached.tag) cached = {}; //if constructor creates a virtual dom element, use a blank object as the base cached node instead of copying the virtual el (#277)
        cached.nodes = [];
        if (dataType === ARRAY) {
            //recursively flatten array
            for (var i = 0, len = data.length; i < len; i++) {
                if (type.call(data[i]) === ARRAY) {
                    data = data.concat.apply([], data);
                    i-- //check current index again and flatten until there are no more nested arrays at that index
                }
            }
            cached.nodes = node;
            for (var i = 0, cacheCount = 0, len = data.length; i < len; i++) {
                if (data[i] === null || data[i] === undefined) continue;
                var item = reviveNode(node[cacheCount], data[i], configs);
                if (item === undefined) continue;
                cached[cacheCount++] = item;
            }
            cached.length = cacheCount;
        } else if (data != null && dataType === OBJECT) {
            if (!data.attrs) data.attrs = {};
            if (!cached.attrs) cached.attrs = {};
            if (type.call(data.tag) != STRING) return;
            cached = {
                tag: data.tag,
                attrs: data.attrs,
                children: data.children != null && data.children.length > 0 ? reviveNode(filterChildNodes(node), data.children, configs) : data.children,
                nodes: [node]
            };
            if (cached.children && !cached.children.nodes) cached.children.nodes = [];
            reviveAttributes(node, data, cached, configs);
        } else if (typeof dataType != FUNCTION) {
            cached = "string number boolean".indexOf(typeof data) > -1 ? new data.constructor(data) : data;
            cached.nodes = [node];
        }
        return cached;
    }

    miso.startTimer = function () {
        clearTimeout(miso.readyTimeout);
        miso.readyTimeout = setTimeout(function () {
            if (!pendingRedraws && pendingRequestsProp() <= 0) {
                miso.done(mRedraw, mRender, mRequest);
            }
        }, miso.readyDelay);
    };

    miso.done = function (mRedraw, mRender, mRequest) {
        var cache = miso.cache;
        var configs = [];
        miso.startTimer = function () {
        };
        redrawProp(redraw);
        m.redraw = mRedraw;
        m.render = mRender;
        m.request = mRequest;
        miso.server = false;
        try {
            for (var mr in renderCache) {
                var entry = renderCache[mr];
                nodeCache[mr] = entry.element;
                var isArray = type.call(entry.cells) === ARRAY;
                var cached = reviveNode(filterChildNodes(entry.element), isArray ? entry.cells : [entry.cells], configs);
                cellCache[mr] = isArray ? cached : cached[0];
            }
            for (var i = 0, l = configs.length; i < l; i++) configs[i]();
            if (miso.verify) {
                nodeCache.forEach(function (node, index) {
                    mRender(node, renderCache[index].cells, false);
                });
            }
        } catch (e) {
            end.reject(e);
        } finally {
            renderCache = autoredraw = miso.autoredraw = miso.redraw = null;
            end.resolve(cache);
        }
    };

    var pendingRedraws = false;
    var redraw = redrawProp();
    redrawProp(function() {
        pendingRedraws = false;
        redraw();
        miso.startTimer();
    });

    var mRedraw = m.redraw;
    m.redraw = function (force) {
        pendingRedraws = true;
        mRedraw(force);
    };
    m.redraw.strategy = mRedraw.strategy;

    var renderCache = {};
    var mRender = m.render;
    m.render = function (element, renderDom) {
        if (!element.hasAttribute('data-mr')) throw new Error('Element was not rendered on server')
        var mr = element.getAttribute('data-mr');
        renderCache[mr] = {
            element: element,
            cells: renderDom
        };
        miso.startTimer();
    };

    var mRequest = m.request;
    m.request = function (options) {
        var promise;
        var method = options.method.toLowerCase();
        var url = options.url;
        var cache = miso.cache;
        m.startComputation();
        if (cache && url in cache && method in cache[url]) {
            var res = m.deferred();
            var entry = cache[url][method];
            entry.err ? res.reject(entry.err) : res.resolve(entry.res);
            promise = res.promise;
        } else {
            promise = mRequest(options);
        }
        promise.then(m.endComputation, m.endComputation);
        return promise;
    };

    miso.init && miso.init(m, mRequest);

    miso.startTimer();

    return end.promise;
};

module.exports = '//MISO BEGIN\nm.iso = (' + toString(clientMiso) + ')(' + args.join(',') + ');\n//MISO END\n';