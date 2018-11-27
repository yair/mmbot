'use strict';

var SortedArrayMap = require("collections/sorted-array-map");

module.exports = function (asks, bids) {

//    this.asks = SortedArrayMap (asks_map, function (a, b) { return a == b; }, function (a, b) { return a < b; });
//    this.bids = SortedArrayMap (bids_map, function (a, b) { return a == b; }, function (a, b) { return a > b; });
    this.asks = asks.reverse();
    this.bids = bids;
//    this.form (limit, cash_value=false) = simple_width (this, limit, cash_value);
//    this.subtract (that) = ob_subtract (this, that);
    this.form = simple_width;
    this.subtract = ob_subtract;
};

function simple_width (ob, limit, cash_value = false) {

    // limit - maximum market depth to consider
    // cash_value - limit is given in asset units (sell side biased) or cash units (buy side biased)

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

    // TODO (fit a prabola to the market depth curve over the range defined by simple_width)
}

function ob_subtract (ob, orders) {
    // we get agregated orders in the ob, so compare amounts as well.
}

