/**
 * Created by karl on 29/1/15.
 */

var mithrilQuery = require('mithril-query');

module.exports = function(miso, serverApp, clientApp, req, options) {
    var cells = options.layout;
    var queryDom = null;

    function find(selector) {
        if (!queryDom) queryDom = mithrilQuery(cells);
        return queryDom.find(selector);
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
        },
        // jsonp support
        createElement: function (tag) {
            return {
                tag: tag.toLowerCase(),
                attrs: {},
                children: []
            }
        }
    };
    // jsonp support
    document.body = document.querySelector('body');
    document.body.appendChild = function (child) {
        document.body.children.push(child);
        if (child.tag === 'script' && child.src) miso.script(child);
    };
    document.body.removeChild = function (child) {
        var children = document.body.children;
        var index = children.indexOf(child);
        if (index >= 0) children.splice(index, 1);
    };
    document.body.replaceChild = function (newChild, oldChild) {
        var children = document.body.children;
        var index = children.indexOf(oldChild);
        if (index >= 0) children[index] = newChild;
    };

    return {
        document: document,
        cells: cells
    }
};