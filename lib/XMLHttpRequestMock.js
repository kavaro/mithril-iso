/**
 * Created by karl on 29/1/15.
 */

var EventEmitter = require('events').EventEmitter;
var extend = require('node.extend');
var httpMocks = require('node-mocks-http');

module.exports = function(serverApp, clientApp, req, options) {
    var socket = req.connection;

    function request(xhr) {
        var req = httpMocks.createRequest(extend({
            method: xhr.method,
            url: xhr.url,
            headers: extend({}, xhr.headers),
            body: xhr.data
        }, options.xhr));
        var res = httpMocks.createResponse(extend({
            eventEmitter: EventEmitter
        }, options.res));
        // override response.json
        var json = res.json;
        res.json = function (json) {
            res.setHeader('Content-Type', 'application/json');
            return res.send(JSON.stringify(json));
        };
        // define response.jsonp
        res.jsonp = function (json) {
            res.setHeader('Content-Type', 'application/javascript');
            return res.send(JSON.stringify(json));
        };
        var socketAddress = socket.address();
        req.socket = extend({
            bufferSize: 0,
            remoteAddress: socket.remoteAddress,
            remotePort: socket.remotePort,
            localAddress: socket.localAddress,
            localPort: socket.localPort,
            address: function () {
                return socketAddress;
            },
            destroy: function () {
            },
            on: function () {
            },
            removeListener: function () {
            }
        }, options.socket);

        res.on('end', function () {
            var status = res.statusCode;
            xhr.status = status >= 0 ? status : 200;
            xhr.responseText = res._getData() || '';
            xhr.readyState = 4;
            xhr.onreadystatechange && xhr.onreadystatechange();
        });

        serverApp.handle(req, res);
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
        request(this);
    };

    return {
        XMLHttpRequest: XMLHttpRequest,
        request: request
    };
};