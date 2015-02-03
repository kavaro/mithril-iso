/**
 * Created by karl on 29/1/15.
 */

var mithrilQuery = require('mithril-query');

module.exports = function(layout, initDocument) {
    var queryDom = null;

    function find(selector) {
        if (!queryDom) queryDom = mithrilQuery(layout);
        return queryDom.find(selector);
    }

    var document = initDocument({
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
        }
    });
    return document;
};