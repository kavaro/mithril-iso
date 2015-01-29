/**
 * Created by karl on 29/1/15.
 */

var extend = require('node.extend');
var XMLHttpRequestMock = require('./XMLHttpRequestMock');
var documentMock = require('./documentMock');

var noop = function () {
};

function setLocation(location, url) {
    location.pathname = url;
    var index = url.indexOf('?');
    location.search = index >= 0 ? url.slice(index) : '';
    index = url.indexOf('#');
    location.hash = index >= 0 ? url.slice(index) : '';
}

module.exports = function(miso, serverApp, clientApp, req, options) {
    var docMock = documentMock(miso, serverApp, clientApp, req, options);
    var xhrMock = XMLHttpRequestMock(serverApp, clientApp, req, options);
    var window = extend(true, {
        document: docMock.document,
        setTimeout: miso.setTimeout,
        clearTimeout: miso.clearTimeout,
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
        XMLHttpRequest: xhrMock.XMLHttpRequest,
        scrollTo: noop,
        miso: miso
    }, options.window);
    setLocation(window.location, req.url);
    return {
        window: window,
        cells: docMock.cells,
        request: xhrMock.request
    };
};