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

    min_trade:          0.0005,

	get_orderbook:		function (market, func) { send_authed_get_cmd ('depth.json', '&market=' + market, x => new OB (x['asks'], x['bids']), func); },
	get_current_orders: function (market, func) { send_authed_get_cmd ('orders.json', '&market=' + market, x => x, func); },
	get_balances:		function (func) { send_authed_get_cmd ('members/me.json', '', x => x['accounts'].reduce ((o,m) => (o[m['currency']]=m['balance'],o), {}), func);},
//	get_balances:		function (func) { send_authed_get_cmd ('members/me.json', '', x => (new Map(x['accounts'].map(i => [i.currency, i.balance]))).
//                                                                                           reduce( (o,[k,v]) => (o[k]=v,o), {} ), func); },
// body: {"sn":"PEARJGFMOHJTIO","name":null,"email":"ma2pha0i@gmail.com","activated":true,"accounts":[{"currency":"gio","balance":"0.0","locked":"0.0"},{"currency":"btc"
//	get_balances:		function (func) { send_authed_get_cmd ('members/me.json', '', x => x['accounts'].reduce( (o,[k,v]) => (o[k]=v,o), {} ), func); },
//	get_balances:		function (func) { send_authed_get_cmd ('members/me.json', '', x => x['accounts'].reduce( (p, c) => (p[c[0]]=c[1],p), {} ), func); },

    delete_orders:      function (orders) { orders.map (o => send_authed_post_cmd ('order/delete.json', '&id=' + o['id'], x => x, null)) },
//    issue_orders:       function (market, orders, func) { send_authed_post_cmd ('orders/multi.json', {'market': market, 'orders': orders}, x => x, func); },
    issue_orders:       function (market, orders, func) { console.log ('Not sending orders: ' + JSON.stringify (orders)); },
}

function send_authed_get_cmd(cmd, params, proc, func) {

    var tonce = new Date().getTime(),
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
        console.log('\n\ncmd: ' + cmd + '\nbody: ' + body + '\n');
//        try {
            if (func!=null) func (proc (JSON.parse(body)));
//        } catch (err) {
//            throw ('send_authed_get_cmd failed to process json response:\nbody=' + body + '\ncmd=' + cmd + '\nerr=' + err);
//        }
    });
}

//function send_authed_post_cmd(cmd, id, tonce, proc, func) {
function send_authed_post_cmd(cmd, params, tonce, proc, func) {

//	var payload = 'POST|' + graviex_api_path + cmd + '|access_key=' + secrets['access_key'] + '&id=' + id + '&tonce=' + tonce,
	var payload = 'POST|' + graviex_api_path + cmd + '|access_key=' + secrets['access_key'] + '&tonce=' + tonce,
        hash = crypto.createHmac('sha256', secrets['secret_key']).update(payload).digest('hex'),
        req = graviex_base_url + graviex_api_path + cmd,
        agentOptions = {
            host: 'graviex.net',
            port: '443',
            path: '/',
            rejectUnauthorized: false
        },
        agent = new https.Agent(agentOptions);

    console.log("sending post request");
    request ({
            url: req,
            method: 'POST',
            agent: agent,
            form: Object.assign (params, {
                access_key: secrets['access_key'],
//                id: id,
                tonce: tonce,
                signature: hash
            }),
        }, function (err, resp, body) {

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

