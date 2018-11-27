'use strict';

// Algo from https://sciencehouse.wordpress.com/2015/06/20/sampling-from-a-probability-distribution/

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
//        console.log("\nr = " + r + " guess = " + x);

        while (err > this.tolerance) {

            if (++iter > this.max_iter) throw ('pdf_sampler::sample() Failed to converge.');
//            console.log ("cdf(x) = " + cdf(x) + " pdf(x) = " + pdf(x));
            var new_x = x - (cdf(x) - r) / pdf(x);
            err = Math.abs (new_x - x);
//            console.log ("new_x = " + new_x + " err = " + err);
            x = new_x;
        }
        return x;
    }
}
