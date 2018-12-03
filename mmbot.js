'use strict';

const fs = require ('fs');
const erf = require ('math-erf');

const argv = require('minimist')(process.argv.slice(2));
const c = JSON.parse (fs.readFileSync (argv['c']));
const exch = require ('./' + c['exchange'] + '.js');
const PDFSampler = require ('./pdf_sampler.js');

go ();

function go() {

	if (c['live'] && Math.random() > 1/c['skip_work']) { return; }

    console.log("fetching data");
    fetch_data (function (ob, prev_orders, account_info) {

        console.log("data fetched. calcing new orders.");

        const new_orders = calc_new_orders (ob, prev_orders, account_info);

		if (c['live']) {
	        console.log("new orders calced. Replacing orders");
	        exch.delete_orders (prev_orders, (pbody) => console.log ("order deleted: " + JSON.stringify(pbody)));
	        exch.issue_orders (new_orders, (pbody) => console.log ("new limit order issued: " + JSON.stringify(pbody)));
		} else
			console.log("Would be order deletions: " + JSON.stringify (prev_orders) + "\nWould be new orders: " + JSON.stringify (new_orders));
    });
}

function fetch_data (func) {

    var ob = null,
        prev_orders = null,
        balances = null;

    exch.get_orderbook (c['market'], function (pbody) {
        console.log("got orderbook");
        ob = pbody;
        if (prev_orders != null && balances != null)
            func (ob, prev_orders, balances);
    });

    exch.get_current_orders (c['market'], function (pbody) {
        console.log("got current orders: " + pbody);
        prev_orders = pbody || [];
        if (ob != null && balances != null)
            func (ob, prev_orders, balances);
    });

    exch.get_balances (function (pbody) {
        console.log("got balances");
        balances = pbody;
        if (ob != null && prev_orders != null)
            func (ob, prev_orders, balances);
    });
}

function calc_new_orders (ob, prev_orders, balances) {

    console.log ("\nob = " + JSON.stringify (ob));
    ob.subtract (prev_orders);
    console.log("1");
    var [midpoint, width] = ob.form(ob, 10000);
    width *= c['width_compression'];
    if (width < c['min_width']) width = c['min_width'];
    if (width > c['max_width']) width = c['max_width'];
    console.log("midpoint = " + midpoint + " width = " + width);
    var pdf, cdf;

    if (c['distribution'] == 'quadratic-normal') {
//        pdf = x => Math.sqrt(width/(midpoint*Math.PI)) * x * x * Math.exp(-x*x/2.);
//        cdf = x => (erf(x)-1.)/2. - Math.sqrt(width/(midpoint*Math.PI)) * x * Math.exp(-x*x/2);
        pdf = x => (1. / Math.sqrt (2 * Math.PI)) * x * x * Math.exp (-x*x/2.);
        cdf = x => ((1. + erf (x/Math.sqrt(2.))) / 2.) - x * Math.exp (-x*x/2.) / Math.sqrt (2. * Math.PI)
    } else throw ("Price distribution " + c['distribution'] + " not supported");

    var left_to_buy  = balances[c['cash']]  * c['buy_fraction'] / (midpoint + width);
    console.log ("balances = " + JSON.stringify(balances));
    console.log ("balances[c['cash']] = balances[" + c['cash'] + "] = " + balances[c['cash']] + " c['buy_fraction'] = " + c['buy_fraction'] + ' left_to_buy = ' + left_to_buy);
//    const min_buy = left_to_buy * c['min_trade'];
    const min_buy = Math.max (c['min_trade'] / (midpoint + width), left_to_buy / c['max_vol_frac']);
    var left_to_sell = balances[c['asset']] * c['sell_fraction'];
    console.log ("balances[c['asset']] = balances[" + c['asset'] + "] = " + balances[c['asset']] + " c['sell_fraction'] = " + c['sell_fraction'] + ' left_to_sell = ' + left_to_sell);
    const min_sell = Math.max (c['min_trade'] / midpoint, left_to_sell / c['max_vol_frac']);
//    const min_sell = left_to_sell * c['min_trade'];

    var orders = [];                                                                                    // min vol on gravi is .5mB, I think.
    var delme = 0;
    const price_distribution = new PDFSampler (pdf, cdf, 1);
    while (true) {

        console.log ((delme++) + ' left_to_buy = ' + left_to_buy + ' left_to_sell = ' + left_to_sell);
        
        if (left_to_sell < min_sell && left_to_buy < min_buy)
            return orders;

        var price = price_distribution.sample();
//        price = midpoint + price * Math.sqrt (midpoint / (2 * width));
        console.log("price = " + price + " => " + (midpoint + price * width / Math.sqrt(2.)));
        price = midpoint + price * width / Math.sqrt(2.);
        if (!isFinite (price)) throw ("Invalid price " + price);
            


        if (price < midpoint) {

            if (left_to_buy < min_buy) continue;
			if (price > ob.min_ask) continue;

            var volume = min_buy / (1 - Math.random());         // https://arxiv.org/pdf/cond-mat/0102518.pdf (empirical, after integration and inversion)
            if (volume > left_to_buy)
                volume = left_to_buy; // continue;	 // <= too many orders?

            left_to_buy -= volume;
            orders.push ({'side': 'buy', 'price': price, 'volume': volume, 'market': c['market']});
        } else {

            if (left_to_sell < min_sell) continue;
			if (price < ob.max_bid) continue;

            var volume = min_sell / (1 - Math.random());
            if (volume > left_to_sell)
                volume = left_to_sell; // continue;

            left_to_sell -= volume;
            orders.push ({'side': 'sell', 'price': price, 'volume': volume, 'market': c['market']});
        }
    }
    return orders;
}
