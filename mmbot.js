'use strict';

const fs = require ('fs');

const c = JSON.parse (fs.readFileSync ('config.json'));
const exch = require ('./' + c['exchange'] + '.js');
const PDFSampler = require ('./pdf_sampler.js');

go (); //TODO: trigger by timer and/or exchange activity

function go() {

    fetch_data (function (ob, prev_orders, account_info) {

        new_orders = calc_new_orders (ob, prev_orders, account_info);

        issue_orders (new_orders);
    });
}

function fetch_data (func) {

    var ob = null,
        prev_orders = null,
        balances = null;

    exch.get_orderbook (c['market'], function (pbody) {
        ob = pbody;
        if (prev_orders != null && balances != null)
            func (ob, prev_orders, balances);
    });

    exch.get_current_orders (c['market'], function (pbody) {
        prev_orders = pbody;
        if (ob != null && balances != null)
            func (ob, prev_orders, balances);
    });

    exch.get_balances (function (pbody) {
        balances = pbody;
        if (ob != null && prev_orders != null)
            func (ob, prev_orders, balances);
    });
}

function calc_new_orders (ob, prev_orders, balances) {

    ob.subtract (prev_orders);
    const [midpoint, width] = ob.form(); // TODO: bind width to a range.

    if (c['distribution'] == 'quadratic-normal') {
        const pdf = x => Math.sqrt(width/(midpoint*Math.PI)) * x * x * Math.exp(-x*x/2.);
        const cdf = x => Math.erf(x) - Math.sqrt(width/(midpoint*Math.PI)) * x * Math.exp(-x*x/2);
    } else throw ("Price distribution " + c['distribution'] + " not supported");

    left_to_buy  = balances[c['cash']]  * c['trade_fraction'];
    min_buy = left_to_buy * c['min_trade'];
    left_to_sell = balances[c['asset']] * c['trade_fraction'];
    min_sell = left_to_sell * c['min_trade'];

    var orders = [] - prev_orders;
    const price_distribution = new PDFSampler (pdf, cdf, midpoint);
    while (true) {

        if (left_to_sell < min_sell && left_to_buy < min_buy)
            return orders;

        price = price_distribution.sample();
        if (price < midpoint) {

            if (left_to_buy < min_buy) continue;

            var volume = min_buy / (1 - Math.random());         // https://arxiv.org/pdf/cond-mat/0102518.pdf (empirical, after integration and inversion)
            if (volume > left_to_buy)
                continue;

            left_to_buy -= volume;
            orders.push ({'type': 'buy', 'price': price, 'volume': volume});
        } else {

            if (left_to_sell < min_sell) continue;

            var volume = min_sell / (1 - Math.random());
            if (volume > left_to_sell)
                continue;

            left_to_sell -= volume;
            orders.push ({'type': 'sell', 'price': price, 'volume': volume});
        }
    }
}

function issue_orders (new_orders) {
}
