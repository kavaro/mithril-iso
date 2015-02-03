/**
 * Created by karl on 2/2/15.
 */

module.exports = function (setTimeout, clearTimeout, frameBudget) {
    var lastRequestAnimationTime = 0;
    var activeRequestAnimations = {};
    var freeRequestAnimationIds = [];
    var requestAnimationCounter = 1;
    return {
        requestAnimationFrame: function (callback) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, frameBudget - (currTime - lastRequestAnimationTime));
            var id = setTimeout(function () {
                callback(currTime + timeToCall);
            }, timeToCall);
            lastRequestAnimationTime = currTime + timeToCall;
            var reqId = freeRequestAnimationIds.length ? freeRequestAnimationIds.pop() : requestAnimationCounter++;
            activeRequestAnimations[reqId] = id;
            return reqId;
        },
        cancelAnimationFrame: function (reqId) {
            if (reqId in activeRequestAnimations) {
                var id = activeRequestAnimations[reqId];
                delete activeRequestAnimations[reqId];
                freeRequestAnimationIds.push(reqId);
                clearTimeout(id);
            }
        }
    }
};