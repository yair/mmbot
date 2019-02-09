'use strict';

const fs = require ('fs'),
      l = require ('winston'),
      u  = require ('./utils.js'),
      OB = require ('./ob.js'),
	  stex = require('stocks-exchange-client'),
      option = u.parse_json (fs.readFileSync ('stex_secrets.json')),
	  sc = new stex.client (option);

module.exports = {

	get_orderbook:		function (market, func) { sc.orderbook (mn (market), function (res) { func (ob_parse (res)) }) },
	get_current_orders: function (market, func) { sc.activeOrders({ 'pair': mn (market), 'owner': 'OWN' }, function (res) { func (co_parse (res)) }) },
	get_balances:		function (func) { sc.userInfo ( function (res) { func (ba_parse (res)) }) },

    delete_orders:      function (orders, delay, func) { orders.map (async (o) => {

                            await u.sleep (Math.floor (parseFloat (delay) * 1000 * Math.random ()));
                            sc.cancelOrder (o['id'], function (res) { func (res) })
                        }) },
    issue_orders:       function (orders, delay, func) { orders.map (async (o) => {

                            await u.sleep (Math.floor (parseFloat (delay) * 1000 * Math.random ()));
                            sc.trade ({ 'type': o['side'], 'pair': mn (o['market']), 'amount': o['volume'], 'rate': o['price'] }, function (res) { func (res) })
                        }) },
}

function ba_parse (res) {

    var resp = u.parse_json (res);
    l.debug ("ba_parse resp = " + JSON.stringify (resp));
    l.debug ("ba_parse: resp['data']['hold_funds']['MIX'] = " + resp['data']['hold_funds']['MIX']);

    return (Object.keys (resp['data']['funds'])).reduce (
        (o, a) => (o[a.toLowerCase()] = parseFloat (resp['data']['funds'][a]) + parseFloat (resp['data']['hold_funds'][a]), o), {});
}

function co_parse (res) {

    var resp = u.parse_json (res);

    return Object.keys (resp['data']).map (x => ({ 'id': x,
                                                   'at':     resp['data'][x]['timestamp'],
                                                   'side':   resp['data'][x]['type'     ],
                                                   'price':  resp['data'][x]['rate'     ],
                                                   'volume': resp['data'][x]['amount'   ],
                                                   'market': rmn (resp['data'][x]['pair']) }));
}

function ob_parse (res) {

    var resp = u.parse_json (res);

    return new OB (resp['result']['sell'].map (x => [x['Rate'], x['Quantity']]),
                   resp['result']['buy' ].map (x => [x['Rate'], x['Quantity']]), false);
}

function mn (market) {  // fugly, might need an api change

    var c = /^(.*)eth$/.exec (market);
    l.debug ("market=" + market + " c=" + JSON.stringify (c));
    if (c != null) {
        return c[1].toUpperCase() + '_ETH';
    }

    c = /^(.*)btc$/.exec (market);
    if (c != null) {
        return c[1].toUpperCase() + '_BTC';
    }
    throw new Error ('Cannot translate market name "' + market + '" to stex naming convention');
}

function rmn (sname) {

    var c = /^(.*)_(.*)$/.exec (sname);

    if (c.length == 3) return c[1].toLowerCase () + c[2].toLowerCase ();

    throw new Error ('Cannot translate market name "' + sname + '" from stex naming convention: ' + JSON.stringify (c));
}

