'use strict';

const fs = require ('fs'),
      crypto = require('crypto'),
      request = require('request'),
      https = require('https');

const OB = require ('./ob.js');

const secrets = JSON.parse (fs.readFileSync ('graviex_secrets.json')),
      graviex_base_url = 'https://graviex.net',
      graviex_api_path = '/api/v2/',
	  MARKET_DEPTH_LIMIT = 300,
	  RESOLUTION = 1e-9;

module.exports = {

	get_orderbook:		function (market, func) { send_authed_get_cmd ('depth.json', '&market=' + market, x => new OB (x['asks'], x['bids']), func); },
	get_current_orders: function (market, func) { send_authed_get_cmd ('orders.json', '&market=' + market, x => x, func); },

	get_account_info:   function (func) { send_authed_post_cmd ('members/me.json', x => x, func); },
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
        try {
            if (func!=null) func (proc (JSON.parse(body)));
        } catch (err) {
            throw ('send_authed_get_cmd failed to process json response:\nbody=' + body + '\ncmd=' + cmd + '\nerr=' + err);
        }
    });
}

function send_authed_post_cmd(cmd, id, tonce, proc, func) {

	var payload = 'POST|' + graviex_api_path + cmd + '|access_key=' + secrets['access_key'] + '&id=' + id + '&tonce=' + tonce,
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
                id: id,
                tonce: tonce,
                signature: hash
            }
        }, function (err, resp, body) {

		if (err) throw ('Error sending post cmd ' + cmd + ': ' + err);
        try {
            if (func!=null) func (proc (JSON.parse(body)));
        } catch (err) {
            throw ('send_authed_post_cmd failed to process json response:\nbody=' + body + '\ncmd=' + cmd + '\nerr=' + err);
        }
	});
}

