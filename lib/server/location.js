/**
 * Created by karl on 2/2/15.
 */

function setLocation(location, url) {
    location.pathname = url;
    var index = url.indexOf('?');
    location.search = index >= 0 ? url.slice(index) : '';
    index = url.indexOf('#');
    location.hash = index >= 0 ? url.slice(index) : '';
}

module.exports = function(url) {
    var loc = {
        location: {
            search: '',
            hash: '',
            pathname: ''
        },
        history: {
            pushState: function (data, title, url) {
                setLocation(loc.location, url);
            },
            replaceState: function (data, title, url) {
                setLocation(loc.location, url);
            }
        }
    };
    if (typeof url === 'string') {
        setLocation(loc.location, url);
    }
    return loc;
};