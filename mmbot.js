'use strict';

const fs = require ('fs');

const c = JSON.parse (fs.readFileSync ('config.json'));
const exch = require ('./' + c['exchange'] + '.js');

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
        account_info = null;

    exch.get_orderbook (c['market'], function (pbody) {
        ob = pbody;
        if (prev_orders != null && account_info != null)
            func (ob, prev_orders, account_info);
    });

    exch.get_current_orders (c['market'], function (pbody) {
        prev_orders = pbody;
        if (ob != null && account_info != null)
            func (ob, prev_orders, account_info);
    });

    exch.get_account_info (function (pbody) {
        account_info = pbody;
        if (ob != null && prev_orders != null)
            func (ob, prev_orders, account_info);
    });
}

function calc_new_orders (ob, prev_orders, account_info) {
}

function issue_orders (new_orders) {
}
