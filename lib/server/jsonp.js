/**
 * Created by karl on 2/2/15.
 */

var extend = require('node.extend');

function jsonp(window, child, request) {
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
            headers: {},
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
        request(xhr, true);
    }
}

var parentNodeMock = {
    removeChild: function () {
    }
};

module.exports = function (request, window) {
    var document = window.document;
    var createElement = document.createElement;
    document.createElement = function (tag) {
        tag = tag.toLowerCase();
        return extend({
            tag: tag,
            attrs: {},
            children: [],
            parentNode: parentNodeMock
        }, createElement ? createElement(tag) : {});
    };
    var body = document.body = document.querySelector('body');
    var bodyAppendChild = body.appendChild;
    body.appendChild = function (child) {
        if (bodyAppendChild) bodyAppendChild(child);
        if (child.tag === 'script' && child.src) {
            jsonp(window, child, request);
        }
    };
};