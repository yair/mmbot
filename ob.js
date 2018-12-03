'use strict';

const regression = require ('regression');

module.exports = function (asks, bids) {

    this.asks = asks.reverse();
    this.bids = bids;
    this.form = parabolic_width;
    this.subtract = ob_subtract;
	this.max_bid = this.bids[0][0];
	this.min_ask = this.asks[0][0];
};

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
    return [midpoint, width];
}

function ob_subtract (ob, orders) {

    outer:
    for (var oid in orders) {

        if (orders[oid]['side'] == 'sell') {

            inner:
            for (var obaid in ob['asks']) {

                if (ob['asks'][obaid][0] == orders[oid]['price']) {

                    ob['asks'][obaid][1] -= orders[oid]['volume'];
                    if (ob['asks'][obaid][1] < 0) throw "ob['asks'][obaid][1] == " + ob['asks'][obaid][1];
                    continue outer;
                }
            }
            throw "Failed to find our ask in the book: " + orders[oid];
        } else {

            inner:
            for (var obbid in ob['bids']) {

                if (ob['bids'][obbid][0] == orders[oid]['price']) {

                    ob['bids'][obbid][1] -= orders[oid]['volume'];
                    if (ob['bids'][obbid][1] < 0) throw "ob['bids'][obbid][1] == " + ob['bids'][obbid][1];
                    continue outer;
                }
            }
            throw "Failed to find our bid in the book: " + orders[oid];
        }
    }
}

