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

    delete_orders:      function (orders, func) { orders.map (o => send_authed_post_cmd ('order/delete.json', o, x => x, func)) },
    issue_orders:       function (orders, func) { orders.map (o => send_authed_buy_cmd ('orders.json', o['market'], o['side'], o['price'], o['volume'], func)); },
}

function sleep (ms) {

	return new Promise (resolve => setTimeout (resolve, ms));
}

async function get_tonce () {

    while (fs.existsSync ('/tmp/.graviex_tonce.lock')) await sleep (1);
    fs.writeFileSync ('/tmp/.graviex_tonce.lock');
    var tonce = Math.max (new Date().getTime(), (parseInt (fs.readFileSync ('/tmp/.graviex_tonce')))) + 1;
    fs.writeFileSync ('/tmp/.graviex_tonce', tonce);
    fs.unlinkSync ('/tmp/.graviex_tonce.lock');
    return tonce;
}

async function send_authed_get_cmd(cmd, params, proc, func) {

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

	await sleep (Math.floor (10000 * Math.random ()));

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

	await sleep (Math.floor (10000 * Math.random ()));

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

	await sleep (Math.floor (10000 * Math.random ()));

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
