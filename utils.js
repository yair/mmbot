'use strict';

module.exports = {

    parse_json: (s) => {

        try {
            var r = JSON.parse (s);
        } catch (e)  {

            const l = require ('winston');
            console.log ("\nJSON parsing failed.\nString was: " + s + "\nError was: " + JSON.stringify (e))
            throw e
        }
        return r;
    },

    sleep: (ms) => (new Promise (resolve => setTimeout (resolve, ms))),
};
