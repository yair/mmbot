'use strict';

const regression = require ('regression');

module.exports = function (asks, bids, reverse_asks = true) {

    this.asks = reverse_asks ? asks.reverse () : asks;
    this.bids = bids;
    this.form = width;
    this.subtract = ob_subtract;
    this.normalized_copy = normalized_copy;
    this.merge_obs = merge_obs;
	this.max_bid = this.bids[0][0];
	this.min_ask = this.asks[0][0];
};

function width (ob, limit, fit_func = 'log-parabolic', cash_value = false) {

    switch (fit_func) {

        case 'simple':
            return simple_width (ob, limit, cash_value);
        case 'parabolic':
            return parabolic_width (ob, limit, cash_value);
        case 'log-parabolic':
            return parabolic_width_of_log_price (ob, limit, cash_value);
        case 'log-linear':
            throw new Error ("TODO");
        default:
            throw ('Unsupported orderbook fitting function ' + fit_func);
    }
}

function simple_width (ob, limit, cash_value = false) {

    // limit - maximum market depth to consider
    // cash_value - limit is given in asset units (sell side biased) or cash units (buy side biased)
    parabolic_width (ob, limit, cash_value);

    var accum = 0;
    var from = 0;
    for (var i = 0; i < ob['bids'].length; i++) {
        var [price, amount] = ob['bids'][i];
        accum += parseFloat(cash_value) ? parseFloat(amount) * parseFloat(price) : parseFloat(amount);
        if (accum >= limit) {
            from = price;
            break;
        }
    }
    if (from == 0) throw ("simple_width: ob depleted on the bid side");
    accum = 0;
    for (var i = 0; i < ob['asks'].length; i++) {
        var [price, amount] = ob['asks'][i];
        accum += cash_value ? parseFloat(amount) * parseFloat(price) : parseFloat(amount);
        if (accum >= limit) {
            return [(parseFloat(price) + parseFloat(from)) / 2., parseFloat(price) - parseFloat(from)];
        }
    }
    throw ("simple_width: ob depleted on the ask side");
}

function parabolic_width_of_log_price (ob, limit, cash_value = false) {

    var accum = 0;
    var points = [], lpoints = [];
    for (var i = 0; i < ob['bids'].length; i++) {

        var [price, amount] = ob['bids'][i];
        accum += parseFloat(cash_value) ? parseFloat(amount) * parseFloat(price) : parseFloat(amount);
        lpoints.push ([Math.log (price), accum]);
        points.push ([price, accum]);
        if (accum >= limit) break;
    }
    accum = 0;
    for (var i = 0; i < ob['asks'].length; i++) {

        var [price, amount] = ob['asks'][i];
        accum += cash_value ? parseFloat(amount) * parseFloat(price) : parseFloat(amount);
        lpoints.push ([Math.log (price), accum]);
        points.push ([price, accum]);
        if (accum >= limit) break;
    }
    const [a, b, c] = regression.polynomial (points, { order: 2 }).equation;
    const [la, lb, lc] = regression.polynomial (lpoints, { order: 2 }).equation;
    const midpoint = Math.exp (-lb / (2. * la));
    const width = Math.sqrt (b * b  - 4. * a * (c - limit)) / a;
    console.log ('parabolic log-midpoint: ' + midpoint + ' width: ' + width + ' (non-log midpoint @' + (-b / (2. * a)) + ')');
    return [midpoint, width];
}

function parabolic_width (ob, limit, cash_value = false) {

    var accum = 0;
    var points = [];
    for (var i = 0; i < ob['bids'].length; i++) {

        var [price, amount] = ob['bids'][i];
        accum += parseFloat(cash_value) ? parseFloat(amount) * parseFloat(price) : parseFloat(amount);
        points.push ([price, accum]);
        if (accum >= limit) break;
    }
    accum = 0;
    for (var i = 0; i < ob['asks'].length; i++) {

        var [price, amount] = ob['asks'][i];
        accum += cash_value ? parseFloat(amount) * parseFloat(price) : parseFloat(amount);
        points.push ([price, accum]);
        if (accum >= limit) break;
    }
    const [a, b, c] = regression.polynomial (points, { order: 2 }).equation;
    const midpoint = -b / (2. * a);
    const width = Math.sqrt (b * b  - 4. * a * (c - limit)) / a;
    console.log ('parabolic midpoint: ' + midpoint + ' width: ' + width);
    return [midpoint, width];
}

function ob_subtract (ob, orders) {

    outer:
    for (var oid in orders) {

        if (orders[oid]['side'] == 'sell') {

            inner:
            for (var obaid in ob['asks']) {

                if (ob['asks'][obaid][0] == orders[oid]['price']) {

                    ob['asks'][obaid][1] -= orders[oid]['remaining_volume'];
                    if (ob['asks'][obaid][1] < 0) console.error ("ERROR: ob['asks'][obaid][1] == " + ob['asks'][obaid][1]);
                    continue outer;
                }
            }
            throw "Failed to find our ask in the book: " + JSON.stringify (orders[oid]);
        } else {

            inner:
            for (var obbid in ob['bids']) {

                if (ob['bids'][obbid][0] == orders[oid]['price']) {

                    ob['bids'][obbid][1] -= orders[oid]['remaining_volume'];
                    if (ob['bids'][obbid][1] < 0) console.error ("ERROR: ob['bids'][obbid][1] == " + ob['bids'][obbid][1]);
                    continue outer;
                }
            }
            throw "Failed to find our bid in the book: " + JSON.stringify (orders[oid]);
        }
    }
}

function normalized_copy (ob, exchr) {

//    console.log (JSON.stringify (ob, null, 2));
/*
    // ob = {"asks":[["0.000000381","4278.6721"],["0.000000391","4053.5996"]
    var rob = JSON.parse (JSON.stringify (ob));
    rob['asks'] = rob['bids'] = [];
    for (var i = 0; i < ob['asks'].length; i++) {
        rob['asks'].push ([ob['asks'][i][0] * exchr, ob['asks'][i][1]]);
    }
    for (var i = 0; i < ob['bids'].length; i++) {
        rob['bids'].push ([ob['bids'][i][0] * exchr, ob['bids'][i][1]]);
    }*/
    var asks = ob['asks'].map (([x, y]) => ([parseFloat (x) * parseFloat (exchr), parseFloat (y)]));
    var bids = ob['bids'].map (([x, y]) => ([parseFloat (x) * parseFloat (exchr), parseFloat (y)]));
    return new module.exports (asks, bids, false);
}

function merge_obs (obs) {
/*
    var asks = [], bids = [];

    for (let obid in obs) {
        var ob = obs[obid];
//        console.log ("Current ob: " + JSON.stringify (ob, null, 2));
        for (var i = 0; i < ob['asks'].length; i++) {
            asks.push (ob['asks'][i]);
        }
        for (var i = 0; i < ob['bids'].length; i++) {
            bids.push (ob['bids'][i]);
        }
    }

    var results = Array.prototype.concat.apply([], a.map(function(doc) { return doc.array; }));*/
    
    var asks = Array.prototype.concat.apply ([], obs.map (ob => ob['asks']));
    var bids = Array.prototype.concat.apply ([], obs.map (ob => ob['bids']));
    asks.sort((a,b) => (a[0] > b[0]) ? 1 : ((a[0] < b[0]) ? -1 : 0));
    bids.sort((a,b) => (a[0] < b[0]) ? 1 : ((a[0] > b[0]) ? -1 : 0));

    console.log ('Combined asks = ' + JSON.stringify (asks));
    console.log ('Combined bids = ' + JSON.stringify (bids));
    const cob = new module.exports (asks, bids, false);
    console.log ('merge_obs: cob = ' + cob);
    console.log ('merge_obs: combined ob form = ' + JSON.stringify (cob.form (cob, 300000, "log-parabolic")));
    return cob;
}
