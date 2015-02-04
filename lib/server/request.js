/**
 * Created by karl on 29/1/15.
 */

var EventEmitter = require('events').EventEmitter;
var extend = require('node.extend');
var parseUrl = require('url-parse');
var httpMocks = require('node-mocks-http');
var crossOriginJsonp = require('request');

function crossOriginRequestIsAllowed(crossOrigin, url) {
    if (crossOrigin === true) return true;
    for (var i = 0, l = crossOrigin.length; i < l; i++) if (crossOrigin[i].test(url)) return true;
}

module.exports = function (serverApp, req, crossOrigin, initCrossOriginReq, initReq, initRes, initSocket, initRoute) {
    var connection = req.connection;
    var host = req.headers.host;
    var protocol = req.protocol + ':';

    function request(xhr, isJsonp) {
        var parsedUrl = parseUrl(xhr.url, true);
        if (!parsedUrl.protocol) parsedUrl.set('protocol', protocol);
        if (!parsedUrl.host) parsedUrl.set('host', host);
        var isCrossOrigin = parsedUrl.protocol !== protocol || parsedUrl.host !== host;
        var url = parsedUrl.toString();
        initRoute({
            url: url,
            xhr: xhr,
            isJsonp: isJsonp,
            isCrossOrigin: isCrossOrigin,
            req: req
        }, function(result) {
            var url = result.url;
            var xhr = result.xhr;
            var isJsonp = result.isJsonp;
            var isCrossOrigin = result.isCrossOrigin;
            var req = httpMocks.createRequest(initReq({
                method: xhr.method,
                url: url,
                headers: extend({}, xhr.headers),
                body: xhr.data
            }, xhr));
            var res = httpMocks.createResponse({
                eventEmitter: EventEmitter
            });
            // override response.json
            res.json = function (json) {
                res.setHeader('Content-Type', 'application/json');
                return res.send(JSON.stringify(json));
            };
            // define response.jsonp
            res.jsonp = function (json) {
                res.setHeader('Content-Type', 'application/javascript');
                return res.send(JSON.stringify(json));
            };
            res = initRes(res, xhr);
            res.on('end', function () {
                var status = res.statusCode;
                xhr.status = status >= 0 ? status : 200;
                xhr.responseText = res._getData() || '';
                xhr.readyState = 4;
                process.nextTick(function () {
                    xhr.onreadystatechange && xhr.onreadystatechange();
                });
            });
            if (isCrossOrigin) {
                if (isJsonp && crossOriginRequestIsAllowed(crossOrigin, url)) {
                    crossOriginJsonp(initCrossOriginReq({
                        method: 'GET',
                        url: url,
                        headers: xhr.headers
                    }, xhr), function (err, response, body) {
                        if (err) {
                            res.send(response.statusCode, body);
                        } else {
                            body = body.slice(body.indexOf('(') + 1, body.indexOf(')'));
                            res.setHeader('Content-Type', 'application/javascript');
                            res.send(body);
                        }
                    });
                } else {
                    res.send(401, JSON.stringify({error: 'CrossOrigin request not authorized: ' + url}));
                }
            } else {
                var connectionAddress = connection.address();
                req.socket = initSocket({
                    bufferSize: 0,
                    remoteAddress: connection.remoteAddress,
                    remotePort: connection.remotePort,
                    localAddress: connection.localAddress,
                    localPort: connection.localPort,
                    address: function () {
                        return connectionAddress;
                    },
                    destroy: function () {
                    },
                    on: function () {
                    },
                    removeListener: function () {
                    }
                }, connection);
                serverApp.handle(req, res);
            }
        });
    }

    function XMLHttpRequest() {
        this.headers = {};
    }

    XMLHttpRequest.prototype.open = function (method, url, asynchronous, user, password) {
        this.method = method;
        this.url = url;
        this.data = {};
        this.asynchronous = asynchronous;
        this.user = user;
        this.password = password;
        this.readyState = 0;
        this.status = -1;
        this.responseText = '';
    };

    XMLHttpRequest.prototype.setRequestHeader = function (key, value) {
        this.headers[key] = value;
    };

    XMLHttpRequest.prototype.send = function (data) {
        this.data = data;
        request(this, false);
    };

    return {
        XMLHttpRequest: XMLHttpRequest,
        request: request
    };
};