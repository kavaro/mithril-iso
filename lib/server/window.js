/**
 * Created by karl on 29/1/15.
 */

var serverRequest = require('./request');
var serverJsonp = require('./jsonp');
var serverDocument = require('./document');
var serverAnimationFrame = require('./animationFrame');
var serverLocation = require('./location');

module.exports = function (miso, serverApp, clientApp, req, layout, options) {
    var document = serverDocument(layout, options.initDocument);
    var serverAnim = serverAnimationFrame(miso.setTimeout, miso.clearTimeout, options.frameBudget);
    var serverLoc = serverLocation(req.url);
    var serverReq = serverRequest(
        serverApp, req,
        options.crossOrigin, options.initCrossOrigin,
        options.initReq, options.initRes, options.initSocket,
        options.initRoute
    );
    var window = options.initWindow({
        miso: miso,
        setTimeout: miso.setTimeout,
        clearTimeout: miso.clearTimeout,
        document: document,
        requestAnimationFrame: serverAnim.requestAnimationFrame,
        cancelAnimationFrame: serverAnim.cancelAnimationFrame,
        location: serverLoc.location,
        history: serverLoc.history,
        XMLHttpRequest: serverReq.XMLHttpRequest,
        scrollTo: function () {
        }
    });
    serverJsonp(serverReq.request, window);
    return window;
};