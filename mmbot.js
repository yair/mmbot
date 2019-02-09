'use strict';

const fs = require ('fs');
const erf = require ('math-erf');
const request = require ('request');

const argv = require('minimist')(process.argv.slice(2));
const u = require ('./utils.js');
const c = u.parse_json (fs.readFileSync (argv['c']));
const l = require ('./logger.js') (c['defaults']['asset']);
const PDFSampler = require ('./pdf_sampler.js');

try {
    go ();
} catch (e) {
    l.error (e);
    throw (e);
}

function go() {

    if (!feel_like_running ()) { return; }

    l.info ("Shitcoin liquifier up and running.");
    bind_handlers_and_lock ();
    apply_market_defaults ();
    instantiate_exchanges ();

    l.info ("Fetching data");
    fetch_data (function () {

        const cob = consolidate_orderbooks ();

        l.info ("Data fetched. Generating price distribution.");

        const pdist = generate_price_distribution (cob);
        sample_new_orders (pdist);

        replace_orders ( function () {

            show_summary (pdist);
        });
    });
}

function replace_orders (func) {

    for (let mid in c['markets']) {
        
        let m = c['markets'][mid];

        if (c['live'] && m['live']) {

	        m['_exch'].delete_orders (m['_prev_orders'], m['cmd_delay'], (pbody) => l.info ("order deleted in " + m['name'] + ": " + JSON.stringify(pbody)));
	        m['_exch'].issue_orders (m['_new_orders'], m['cmd_delay'], (pbody) => l.info ("new limit order in " + m['name'] + " issued: " + JSON.stringify(pbody)));
        } else {

            l.warn ("\nMarket is dead. Not removing or issuing orders.\n");
        }
        l.debug ("\nFull dump of " + m['name'] + ":\n" + JSON.stringify (m));
    }
    func ();
}

function show_summary (pdist) {

    const [base_midpoint, base_width, sampler] = pdist;
    var exs = {}, tots = {}, asset, gt=0.;

    for (let min in c['markets']) {

        let m = c['markets'][min];

        l.info ('\nSummary for ' + m['name'] + ' --');
        l.info ('Total ' + m['base'] + ' - ' + m['_balances'][m['base']]);
        l.info ('Total ' + m['asset'] + ' - ' + m['_balances'][m['asset']]);
        if (m['base'] in tots) {
            tots[m['base']] += parseFloat (m['_balances'][m['base']]);
        } else {
            tots[m['base']] = parseFloat (m['_balances'][m['base']]);
        }
        if (m['asset'] in tots) {
            if (!(m['exchange'] in exs)) {
                tots[m['asset']] += parseFloat (m['_balances'][m['asset']]);
            }
        } else {
            tots[m['asset']] = parseFloat (m['_balances'][m['asset']]);
        }
        asset = m['asset'];
    }

    l.info ("");

    for (let tin in Object.keys (tots)) {

        let t = Object.keys (tots)[tin], base_value;

        if (t in c['_bexchrs']) {
            base_value = tots[t] * parseFloat (c['_bexchrs'][t]);
        } else if (t == asset) {
            base_value = tots[t] * base_midpoint;
        } else if (t == c['global_base']) {
            base_value = tots[t];
        } else {
            throw new Error ("Unrecognized asset " + t);
        }
        gt += base_value;

        l.info ("total " + t + " = " + tots[t] + ' (= ' + base_value + c['global_base'] + ')');
    }

    l.info ('Grand total: ' + gt + c['global_base'] + ' (=' + (gt / base_midpoint) + asset + ')');
}

function feel_like_running () {

    if (fs.existsSync (c['lock_file']) ||
	    c['live'] && Math.random() > 1/c['skip_work']) {

        return false;
    }
    return true;
}

function exit_handler (e) {

    if (fs.existsSync (c['lock_file'])) fs.unlinkSync (c['lock_file']);
    if (e != null && isNaN (e)) { 
        l.error (e);
    }
}

function bind_handlers_and_lock () {

    process.on('exit', exit_handler.bind(null));
    process.on('SIGINT', exit_handler.bind(null));
    process.on('SIGUSR1', exit_handler.bind(null));
    process.on('SIGUSR2', exit_handler.bind(null));
    process.on('uncaughtException', e => exit_handler(e));

    fs.open (c['lock_file'], "wx", function (err, fd) { fs.close (fd, function (err) {}) });
}

function apply_market_defaults () {

    for (var def in c['defaults']) {
        l.debug ('applying ' + def + ' default');
        for (var market in c['markets']) {
            if (!(def in c['markets'][market])) {

                c['markets'][market][def] = c['defaults'][def];
    }   }   }
}

function instantiate_exchanges () {

    for (var i = 0; i < c['markets'].length; i++) {

        c['markets'][i]["_exch"] = require ('./' + c['markets'][i]['exchange'] + '.js');
    }
}

function data_fetched () {

    for (var i = 0; i < c['markets'].length; i++) {

        if (!("_ob" in c['markets'][i]) ||
            !("_prev_orders" in c['markets'][i]) ||
            !("_balances" in c['markets'][i])) {

                return false;
        }
    }
    for (var base in c['_bexchrs']) {

        if (c['_bexchrs'][base] == 0) return false;
    }

    l.debug ("data_fetched returning true. base exchange rate are: " + JSON.stringify (c['_bexchrs'], null, 2) + "");
    return true;
}

function fetch_data (func) {

    c['_bexchrs'] = {};

    for (let i = 0; i < c['markets'].length; i++) {

        c['markets'][i]['_exch'].get_orderbook (c['markets'][i]['market'], function (pbody) {

            l.debug ("got the " + c['markets'][i]['name'] + " orderbook.");
            c['markets'][i]['_ob'] = pbody;
            if (data_fetched ()) func ();
        });

        c['markets'][i]['_exch'].get_current_orders (c['markets'][i]['market'], function (pbody) {

            l.debug("got the " + c['markets'][i]["name"] + " current orders.");
            c['markets'][i]['_prev_orders'] = pbody;
            if (data_fetched ()) func ();
        });

        c['markets'][i]['_exch'].get_balances ( function (pbody) {

            c['markets'][i]['_balances'] = pbody;
            l.debug ("got the " + c['markets'][i]["name"] + " balances - " + JSON.stringify (c['markets'][i]['_balances']));
            if (data_fetched ()) func ();
        });

        if (c['markets'][i]['base'] != c['global_base']) {

            l.debug ("fetch_data - need to conver market " + i + " exchange rate for " + c['markets'][i]['base']);
            c['_bexchrs'][c['markets'][i]['base']] = 0;
        } else {
            l.debug ("fetch_data - no need to conver market " + i + " exchange rate for " + c['markets'][i]['base']);
        }
    }

    for (let base in c['_bexchrs']) {

        l.debug ("fetch_data - Fetching exchange rate for " + base);

        request.get ('https://min-api.cryptocompare.com/data/price?fsym=' + base.toUpperCase() + '&tsyms=' + c['global_base'].toUpperCase(),
            function (err, resp, body) {

                if (err) throw new Error ("ccompare error while getting " + base + " exchange rate: ", err);
                c['_bexchrs'][base] = u.parse_json (body)[c['global_base'].toUpperCase()];
                l.debug ("fetch_data - got exchange rate for " + base + " - " + c['_bexchrs'][base] + " (body="+body+")");


                if (data_fetched ()) func ();
            }.bind (base));
    }
}

function normalized_ob (m) {

    if (m['base'] == c['global_base']) {


        l.debug ("(m['base'] = " + m['base'] + ", c['global_base'] = " + c['global_base'] + ". Skipping normalization.");
        return m['_ob'];
    }

    l.debug ("(m['base'] = " + m['base'] + ", c['global_base'] = " + c['global_base'] + ". Normalizing.");

    return m['_ob'].normalized_copy (m['_ob'], c['_bexchrs'][m['base']]);
}

function consolidate_orderbooks () {

    var obs = [];

    l.silly ("in consolidate: markets = " + JSON.stringify (c['markets'], null, 2));

    for (let i = 0; i < c['markets'].length; i++) {

        let m = c['markets'][i];
        l.debug ("i = " + i + " market name = " + m['name']);
        l.debug ("pre-subtract 100k ob form = " + JSON.stringify (m['_ob'].form (m['_ob'], 100000, c['fit_function'])));
        m['_ob'].subtract (m['_prev_orders']);
        l.debug ("post-subtract 100k ob form = " + JSON.stringify (m['_ob'].form (m['_ob'], 100000, c['fit_function'])));
        const nob = normalized_ob (m);
        l.info ("normalized " + m['name'] + " ob 100k form = " + JSON.stringify (nob.form (nob, 100000, c['fit_function'])));
        obs.push (nob);
    }

    l.silly ('obs = ' + JSON.stringify (obs, null, 2));
    const cob = c['markets'][0]['_ob'].merge_obs (obs); //TODO: should be static
    l.info ('combined ob 300k form = ' + JSON.stringify (cob.form (cob, 300000, c['fit_function'])));
    return cob;
}

function generate_price_distribution (cob) {

    var [midpoint, width] = cob.form (cob, c['visible_depth'], c['fit_function']);
    width *= c['width_compression'];
    if (width < c['min_width']) width = c['min_width'];
    if (width > c['max_width']) width = c['max_width'];
    var pdf, cdf;

    if (c['distribution'] == 'quadratic-normal') {

        pdf = x => (1. / Math.sqrt (2 * Math.PI)) * x * x * Math.exp (-x*x/2.);
        cdf = x => ((1. + erf (x/Math.sqrt(2.))) / 2.) - x * Math.exp (-x*x/2.) / Math.sqrt (2. * Math.PI)
    } else
        throw ("Price distribution " + c['distribution'] + " not supported");

    return [midpoint, width, new PDFSampler (pdf, cdf, 1)];
}

function sample_new_orders (pdist) {

    const [base_midpoint, base_width, sampler] = pdist;

    for (let mid in c['markets']) {

        const m = c['markets'][mid];

        if (c['global_base'] == m['base']) {
            var [midpoint, width] = [base_midpoint, base_width];
        } else {
            var [midpoint, width] = [base_midpoint / c['_bexchrs'][m['base']], base_width / c['_bexchrs'][m['base']]];
        }
        
        l.debug ("\nSampling orders for " + m['name']);
        l.debug (m['name'] + ' ' + m['base']  + ' balances - ' + JSON.stringify (m['_balances'][m['base']]));
        l.debug (m['name'] + ' ' + m['asset'] + ' balances - ' + JSON.stringify (m['_balances'][m['asset']]));

        var left_to_buy  = m['_balances'][m['base']]  * m['buy_fraction'] / (midpoint + width);
        const min_buy = Math.max (m['min_trade'] / (midpoint + width), left_to_buy / m['max_vol_frac']);
        l.debug ('Init - left_to_buy = ' + left_to_buy + ' and min_buy = ' + min_buy + ' buy fraction ' + m['buy_fraction']);

        var left_to_sell = m['_balances'][m['asset']] * m['sell_fraction'];
        const min_sell = Math.max (m['min_trade'] / midpoint, left_to_sell / m['max_vol_frac']);
        l.debug ('Init - left_to_sell = ' + left_to_sell + ' and min_sell = ' + min_sell + ' sell fraction ' + m['sell_fraction']);

        l.debug ('m[_ob].min_ask = ' + m['_ob'].min_ask);
        l.debug ('m[_ob].max_bid = ' + m['_ob'].max_bid);
        m['_new_orders'] = [];

        while (true) {

            if (left_to_sell < min_sell && left_to_buy < min_buy)
                break;

            var price = sampler.sample();
            price = midpoint + price * width / Math.sqrt(2.);
            if (!isFinite (price)) throw new Error("Invalid price " + price + " sampled from " + m['name']);

            if (price < midpoint) {

                if (left_to_buy < min_buy) continue;
                if (price > m['_ob'].min_ask) {
                    l.info ('Buy price exceeds lowest ask in ' + m['name'] + ' (skipping)');
                    continue;
                }

                var volume = min_buy / (1 - Math.random());         // https://arxiv.org/pdf/cond-mat/0102518.pdf (empirical, after integration and inversion)
                if (volume > left_to_buy)
                    volume = left_to_buy; // continue;	 // <= too many orders?
//                    continue;

                left_to_buy -= volume;
                l.debug ('pushing a buy order at ' + price + ', volume = ' + volume + ' and ' + left_to_buy + ' left to buy.');
                m['_new_orders'].push ({'side': 'buy', 'price': price, 'volume': volume, 'market': m['market']});
            } else {

                if (left_to_sell < min_sell) continue;
                if (price < m['_ob'].max_bid) {
                    l.info ('Sell price exceeds highest bid in ' + m['name'] + ' (skipping)');
                    continue;
                }

                var volume = min_sell / (1 - Math.random());
                if (volume > left_to_sell)
                    volume = left_to_sell; // continue; // <= too many orders?
//                    continue;

                left_to_sell -= volume;
                l.debug ('pushing a sell order at ' + price + ', volume = ' + volume + ' and ' + left_to_sell + ' left to sell.');
                m['_new_orders'].push ({'side': 'sell', 'price': price, 'volume': volume, 'market': m['market']});
            }
        }
    }
}

