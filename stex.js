'use strict';

const fs = require ('fs'),
      OB = require ('./ob.js'),
	  stex = require('stocks-exchange-client'),
      option = JSON.parse (fs.readFileSync ('stex_secrets.json')),
	  sc = new stex.client (option);

module.exports = {

	get_orderbook:		function (market, func) { sc.orderbook (mn (market), function (res) { func (ob_parse (res)) }) },
//	get_orderbook:		function (market, func) { send_authed_get_cmd ('depth.json', '&market=' + market, x => new OB (x['asks'], x['bids']), func); },
//	get_current_orders: function (market, func) { sc.activeOrders({ 'pair': mn (market), 'owner': 'ALL' }, function (res) { func (co_parse (res)) }) },
	get_current_orders: function (market, func) { sc.activeOrders({ 'pair': mn (market), 'owner': 'OWN' }, function (res) { func (co_parse (res)) }) },
//	get_current_orders: function (market, func) { send_authed_get_cmd ('orders.json', '&market=' + market, x => x, func); },
	get_balances:		function (func) { sc.userInfo ( function (res) { func (ba_parse (res)) }) },
//	get_balances:		function (func) { send_authed_get_cmd ('members/me.json', '', x => x['accounts'].reduce ((o,m) => (o[m['currency']]=m['balance'],o), {}), func);},

    delete_orders:      function (orders, delay, func) { orders.map (async (o) => {
                            await sleep (Math.floor (parseFloat (delay) * 1000 * Math.random ()));
                            sc.cancelOrder (o['id'], function (res) { func (res) })
                        }) },
//    delete_orders:      function (orders, func) { orders.map (o => send_authed_post_cmd ('order/delete.json', o, x => x, func)) },
    issue_orders:       function (orders, delay, func) { orders.map (async (o) => {
                            await sleep (Math.floor (parseFloat (delay) * 1000 * Math.random ()));
                            sc.trade ({ 'type': o['side'], 'pair': mn (o['market']), 'amount': o['volume'], 'rate': o['price'] }, function (res) { func (res) })
                        }) },
                                                                               
                                                                               
                                                                               
//    issue_orders:       function (orders, func) { orders.map (o => send_authed_buy_cmd ('orders.json', o['market'], o['side'], o['price'], o['volume'], func)); },
}

function ba_parse (res) {

    var resp = JSON.parse (res);
    console.log ("ba_parse resp = " + JSON.stringify (resp));
    console.log ("ba_parse: resp['data']['hold_funds']['MIX'] = " + resp['data']['hold_funds']['MIX']);
/* { "success": 1, "data": { "email": "some_email@gmail.com", "username":"some_username", "userSessions": [{"ip":"46.164.189.25", "date":"2016-06-29 15:41:21", "created_at":"2016-06-28 20:30:28", "active":false}], funds": {"NXT": "8", "BTC": "0.018"}, hold_funds": { "NXT": "18", "BTC": "0"}, */

//    return Object.keys (resp['data']['funds']).map ( x => ({[x.toLowerCase()]: resp['data']['funds'][x]}));
//    return (Object.keys (resp['data']['funds'])).reduce ((o, a) => {console.log ("o="+JSON.stringify(o)+" a="+JSON.stringify(a)); o[a.toLowerCase()] = parseFloat (resp['data']['funds'][a]) + parseFloat (resp['data']['hold_funds'][a]); return o}, {});
    return (Object.keys (resp['data']['funds'])).reduce (
        (o, a) => (o[a.toLowerCase()] = parseFloat (resp['data']['funds'][a]) + parseFloat (resp['data']['hold_funds'][a]), o), {});
//    return Object.assign (Object.entries (resp['data']['funds']).map (([a, v]) => ({[a.toLowerCase()]: (parseFloat (v) + parseFloat (resp['data']['hold_funds'][a])) })));
//    let newObj = Object.assign(...Object.entries(obj).map(([k, v]) => ({[k]: v * v})));
//    return resp['data']['funds'].reduce ((o,m) => (o[m['currency']]=m['balance'],o), {})
}

function co_parse (res) {

    var resp = JSON.parse (res);
// "_prev_orders": "{\"success\":1,\"data\":{\"51701807\":{\"pair\":\"MIX_ETH\",\"type\":\"sell\",\"amount\":\"25000\",\"rate\":\"0.000028\",\"is_your_order\":0,\"timestamp\":1549122882},\"51701844\":{\"pair\":\"MIX_ETH\",\"type\":\"sell\",\"amount\":\"25000\",\"rate\":\"0.000029\",\"is_your_order\":0,\"timestamp\":1549122887},
/*    "_prev_orders": [
      {
        "id": 19096431,
        "at": 1549426872,
        "side": "sell",
        "ord_type": "limit",
        "price": "0.000000694",
        "avg_price": "0.0",
        "state": "wait",
        "market": "mixbtc",
        "created_at": "2019-02-06T04:21:12Z",
        "volume": "1339.5853",
        "remaining_volume": "1339.5853",
        "executed_volume": "0.0",
        "trades_count": 0
      },*/

    return Object.keys (resp['data']).map (x => ({ 'id': x,
                                                   'at':     resp['data'][x]['timestamp'],
                                                   'side':   resp['data'][x]['type'     ],
                                                   'price':  resp['data'][x]['rate'     ],
                                                   'volume': resp['data'][x]['amount'   ],
                                                   'market': rmn (resp['data'][x]['pair']) }));
}

function ob_parse (res) {

    var resp = JSON.parse (res);
    return new OB (resp['result']['sell'].map (x => [x['Rate'], x['Quantity']]),
                   resp['result']['buy' ].map (x => [x['Rate'], x['Quantity']]), false);
}

function mn (market) {  // fugly, might need an api change
    var c = /^(.*)eth$/.exec (market);
    console.log ("market=" + market + " c=" + JSON.stringify (c));
//    if (c.length > 0) {
    if (c != null) {
        return c[1].toUpperCase() + '_ETH';
    }
    c = /^(.*)btc$/.exec (market);
//    if (c.length > 0) {
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

function sleep (ms) {

	return new Promise (resolve => setTimeout (resolve, ms));
}

async function get_tonce () {

//    console.log ('entered get_tonce');
    while (fs.existsSync ('/tmp/.graviex_tonce.lock')) await sleep (1);
    fs.writeFileSync ('/tmp/.graviex_tonce.lock');
//    console.log ('lock no longer exists, wrote our own.');
    var current_tonce = 0;
    if (fs.existsSync('/tmp/.graviex_tonce')) {
//        console.log ('tonce exists. reading.');
        current_tonce = parseInt (fs.readFileSync ('/tmp/.graviex_tonce'));
//        console.log ('tonce read - ' + current_tonce);
    }
//  var tonce = Math.max (new Date().getTime(), (,parseInt (fs.readFileSync ('/tmp/.graviex_tonce'))) || 0) + 1;
    var tonce = Math.max (new Date().getTime(), current_tonce) + 1;
//    console.log ('new tonce - ' + tonce);
    fs.writeFileSync ('/tmp/.graviex_tonce', tonce);
//    console.log ('wrote new tonce');
    fs.unlinkSync ('/tmp/.graviex_tonce.lock');
//    console.log ('unlinked lock');
    return tonce;
}

async function send_authed_get_cmd(cmd, params, proc, func) {

	await sleep (Math.floor (1000 * Math.random ()));

    var tonce = await get_tonce(),
        payload = 'GET|' + graviex_api_path + cmd + '|access_key=' + secrets['access_key'] + params + '&tonce=' + tonce,
        hash = crypto.createHmac('sha256', secrets['secret_key']).update(payload).digest('hex'),
        req = graviex_base_url + graviex_api_path + cmd + '?access_key=' + secrets['access_key'] + params + '&tonce=' + tonce + '&signature=' + hash,
        agentOptions = {
            host: 'graviex.net',
            port: '443',
            path: '/',
            rejectUnauthorized: false
        },
        agent = new https.Agent(agentOptions);

    request({
            url: req,
            method: 'GET',
            agent: agent
        }, function (err, resp, body) {

        if (err) throw('Error sending get cmd ' + cmd + ': ' + err);
        if (func != null) func (proc (JSON.parse(body)));
    });
}

async function send_authed_post_cmd(cmd, params, proc, func) {

	await sleep (Math.floor (30000 * Math.random ()));

    var tonce = await get_tonce(),
	    payload = 'id' in params ? 'POST|' + graviex_api_path + cmd + '|access_key=' + secrets['access_key'] + '&id=' + params['id'] + '&tonce=' + tonce :
                                   'POST|' + graviex_api_path + cmd + '|access_key=' + secrets['access_key'] + '&market=' + params['market']
                                           + '&price=' + params['price'] + '&side=' + params['side'] + '&tonce=' + tonce + '&volume='
                                           + params['volume'],
        hash = crypto.createHmac('sha256', secrets['secret_key']).update(payload).digest('hex'),
        req = graviex_base_url + graviex_api_path + cmd,
        agentOptions = {
            host: 'graviex.net',
            port: '443',
            path: '/',
            rejectUnauthorized: false
        },
        agent = new https.Agent(agentOptions);

    request ({
            url: req,
            method: 'POST',
            agent: agent,
            form: /* Object.assign (params, */ {
                access_key: secrets['access_key'],
				id: params['id'],
//                id: id,
                tonce: tonce,
                signature: hash
            } /*)*/,
        }, function (err, resp, body) {

        if (resp['statusCode'] == 405)
            throw ("405 method not allowed:\nbody=" + body + "\nerr=" + err + "\nresp=" + JSON.stringify(resp) + "\ncmd=" + cmd + "\nparams=" + JSON.stringify(params));
		if (err) throw ('Error sending post cmd ' + cmd + ': ' + err);
        if (func != null) func (proc (JSON.parse(body)));
	});
}

async function send_authed_buy_cmd (cmd, market, side, price, volume, func) {

	await sleep (Math.floor (30000 * Math.random ()));

    var tonce = await get_tonce(),
        payload = 'POST|' + graviex_api_path + cmd + '|access_key=' + secrets['access_key'] + '&market=' + market + '&price=' + price.toFixed(9) + '&side=' + side + '&tonce=' + tonce + '&volume=' + volume.toFixed(4),
        hash = crypto.createHmac('sha256', secrets['secret_key']).update(payload).digest('hex'),
        req = graviex_base_url + graviex_api_path + cmd,
        agentOptions = {
            host: 'graviex.net',
            port: '443',
            path: '/',
            rejectUnauthorized: false
        },
        agent = new https.Agent(agentOptions);

    request ({
            url: req,
            method: 'POST',
            agent: agent,
            form: {
                access_key: secrets['access_key'],
                market: market,
                side: side,
                volume: volume.toFixed(4),
                price: price.toFixed(9),
                tonce: tonce,
                signature: hash
            }
        }, function (err, resp, body) {

        if (err) throw ('Error sending post cmd ' + cmd + ': ' + err);
        if (func != null) func (JSON.parse(body));
    });
}
