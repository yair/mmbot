'use strict';

const fs = require ('fs'),
      crypto = require('crypto'),
      request = require('request'),
      https = require('https');

const OB = require ('./ob.js');

const secrets = JSON.parse (fs.readFileSync ('graviex_secrets.json')),
      graviex_base_url = 'https://graviex.net',
      graviex_api_path = '/api/v2/';

module.exports = {

	get_orderbook:		function (market, func) { send_authed_get_cmd ('depth.json', '&market=' + market, x => new OB (x['asks'], x['bids']), func); },
	get_current_orders: function (market, func) { send_authed_get_cmd ('orders.json', '&market=' + market, x => x, func); },
	get_balances:		function (func) { send_authed_get_cmd ('members/me.json', '', x => x['accounts'].reduce ((o,m) => (o[m['currency']]=m['balance'],o), {}), func);},
//	get_balances:		function (func) { send_authed_get_cmd ('members/me.json', '', x => (new Map(x['accounts'].map(i => [i.currency, i.balance]))).
//                                                                                           reduce( (o,[k,v]) => (o[k]=v,o), {} ), func); },
//	get_balances:		function (func) { send_authed_get_cmd ('members/me.json', '', x => x['accounts'].reduce( (o,[k,v]) => (o[k]=v,o), {} ), func); },
//	get_balances:		function (func) { send_authed_get_cmd ('members/me.json', '', x => x['accounts'].reduce( (p, c) => (p[c[0]]=c[1],p), {} ), func); },

//    delete_orders:      function (orders) { orders.map (o => send_authed_post_cmd ('order/delete.json', '&id=' + o['id'], x => x, null)) },
    delete_orders:      function (orders, func) { orders.map (o => send_authed_post_cmd ('order/delete.json', o, x => x, func)) },
//function send_authed_buy_cmd(cmd, price, volume, func) {
//	issue_orders:		function (orders, func) { send_authed_buy_cmds_recursively (orders, func); },
    issue_orders:       function (orders, func) { orders.map (o => send_authed_buy_cmd ('orders.json', o['market'], o['side'], o['price'], o['volume'], func)); },
//    issue_orders:       function (orders, func) { orders.map (o => send_authed_post_cmd ('orders.json', o, x => x, func)); },
//    issue_orders:       function (market, orders, func) { send_authed_post_cmd ('orders/multi.json', {'market': market, 'orders': orders}, x => x, func); },
//    issue_orders:       function (market, orders, func) { console.log ('Not sending orders: ' + JSON.stringify (orders)); },
}

function sleep (ms) {

	return new Promise(resolve => setTimeout(resolve, ms));
}

function get_tonce () {

    while (fs.existsSync ('/tmp/.graviex_tonce.lock')) sleep (1);
    fs.writeFileSync ('/tmp/.graviex_tonce.lock');
    var tonce = Math.max (new Date().getTime(), (parseInt (fs.readFileSync ('/tmp/.graviex_tonce')) || 0)) + 1;
    console.log ('/tmp/.graviex_tonce reads ' + (parseInt (fs.readFileSync ('/tmp/.graviex_tonce')) || 0) + ' tonce is ' + tonce);
    fs.writeFileSync ('/tmp/.graviex_tonce', tonce);
    fs.unlinkSync ('/tmp/.graviex_tonce.lock');
    return tonce;
}

async function send_authed_get_cmd(cmd, params, proc, func) {

    var tonce = get_tonce(),
//    var tonce = new Date().getTime() + ++cmdsn,
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

	await sleep (Math.random (10000));

    request({
            url: req,
            method: 'GET',
            agent: agent
        }, function (err, resp, body) {

        if (err) throw('Error sending get cmd ' + cmd + ': ' + err);
        console.log('\n\ncmd: ' + cmd + '\nbody: ' + body + '\n');
//        try {
            if (func!=null) func (proc (JSON.parse(body)));
//        } catch (err) {
//            throw ('send_authed_get_cmd failed to process json response:\nbody=' + body + '\ncmd=' + cmd + '\nerr=' + err);
//        }
    });
}

//function send_authed_post_cmd(cmd, id, tonce, proc, func) {
async function send_authed_post_cmd(cmd, params, proc, func) {

//    var tonce = String ((new Date().getTime() + 10*(++cmdsn)) % 10 + tonce_offset),
    var tonce = get_tonce(),
//    var tonce = new Date().getTime() + ++cmdsn,
//	var payload = 'POST|' + graviex_api_path + cmd + '|access_key=' + secrets['access_key'] + '&id=' + id + '&tonce=' + tonce,
	    payload = 'id' in params ? 'POST|' + graviex_api_path + cmd + '|access_key=' + secrets['access_key'] + '&id=' + params['id'] + '&tonce=' + tonce :
                                   'POST|' + graviex_api_path + cmd + '|access_key=' + secrets['access_key'] + '&market=' + params['market']
                                           + '&price=' + params['price'] + '&side=' + params['side'] + '&tonce=' + tonce + '&volume='
                                           + params['volume'],
//                                           + '&price=' + params['price'].toFixed(9) + '&side=' + params['side'] + '&tonce=' + tonce + '&volume='
//                                           + params['volume'].toFixed(4),
        hash = crypto.createHmac('sha256', secrets['secret_key']).update(payload).digest('hex'),
        req = graviex_base_url + graviex_api_path + cmd,
        agentOptions = {
            host: 'graviex.net',
            port: '443',
            path: '/',
            rejectUnauthorized: false
        },
        agent = new https.Agent(agentOptions);

	await sleep (Math.random (10000));

    console.log("sending post request. payload = " + payload + "\nhash=" + hash);
//	return;
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

        console.log (cmd + ': err=' + err + ' resp=' + JSON.stringify (resp) + ' body=' + body);
        if (resp['statusCode'] == 405)
            throw ("405 method not allowed:\nbody=" + body + "\nerr=" + err + "\nresp=" + JSON.stringify(resp) + "\ncmd=" + cmd + "\nparams=" + JSON.stringify(params));
		if (err) throw ('Error sending post cmd ' + cmd + ': ' + err);
//        try {
            if (func!=null) func (proc (JSON.parse(body)));
//        } catch (err) {
//            throw ('send_authed_post_cmd failed to process json response:\nbody=' + body + '\ncmd=' + cmd + '\nerr=' + err);
//        }
	});
}

function send_authed_buy_cmds_recursively (orders, func) {

	var o = orders.pop();

	send_authed_buy_cmd ('orders.json', o['price'], o['volume'], orders.len > 0 ? (() => send_authed_buy_cmds_recursively (orders, func)) : func);
}

async function send_authed_buy_cmd(cmd, market, side, price, volume, func) {

    var tonce = get_tonce(),
//    var tonce = String ((new Date().getTime() + 10*(++cmdsn)) % 10 + tonce_offset),
//    var tonce = new Date().getTime() + ++cmdsn,
//      payload = 'POST|' + graviex_api_path + cmd + '|access_key=' + graviex_access_key + '&market=mixbtc&side=buy&volume=' + volume + '&price=' + price + '&tonce=' + tonce,
        payload = 'POST|' + graviex_api_path + cmd + '|access_key=' + secrets['access_key'] + '&market=' + market + '&price=' + price.toFixed(9) + '&side=' + side + '&tonce=' + tonce + '&volume=' + volume.toFixed(4),
        hash = crypto.createHmac('sha256', secrets['secret_key']).update(payload).digest('hex'),
        req = graviex_base_url + graviex_api_path + cmd,
//      data = 'access_key=' + graviex_access_key + '&id=' + id + '&tonce=' + tonce + '&signature=' + hash,
        agentOptions = {
            host: 'graviex.net',
            port: '443',
            path: '/',
            rejectUnauthorized: false
        },
        agent = new https.Agent(agentOptions);

console.log('payload=' + payload);
console.log('hash=' + hash);

	await sleep (Math.random (10000));

	var form = {
                access_key: secrets['access_key'],
                market: market,
                side: side,
                volume: volume.toFixed(4),
                price: price.toFixed(9),
                tonce: tonce,
                signature: hash
            };
	console.log ('form: ' + JSON.stringify (form));
//	return;
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
            console.log('request: ' + req);
            if (err) console.log('Error: ' + err);
//          console.log('Response: ' + JSON.stringify(resp, null, 2));
            try {
                console.log('Body: ' + JSON.stringify(JSON.parse(body), null, 2));
            }
            catch(e) {
                console.log('Invalid JSON is Body: ' + body);
            }
//          console.log('Body: ' + body);

            if (func!=null) func(JSON.parse(body));
        });
}
