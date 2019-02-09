'use strict';

// Algo from https://sciencehouse.wordpress.com/2015/06/20/sampling-from-a-probability-distribution/

const l = require ('winston');

module.exports = function (pdf, cdf, guess, tolerance=1e-8) {

    this.pdf = pdf;
    this.cdf = cdf;
    this.guess = guess;
    this.tolerance = tolerance;
    this.max_iter = 100;

    this.sample = function (prob = null) {

        const r = prob || Math.random();
        var x = r > 0.5 ? this.guess : -this.guess;
        var err = Number.POSITIVE_INFINITY;
        var iter = 0;

        while (err > this.tolerance) {

            if (++iter > this.max_iter) throw ('pdf_sampler::sample() Failed to converge.');
            var new_x = x - (cdf(x) - r) / pdf(x);
            err = Math.abs (new_x - x);
            x = new_x;
        }
        return x;
    }
}
