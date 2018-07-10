"use strict";

const cmpscraper = require('./cmpscraper.js');
const events = require('events');
const mailer = require('./mailer');

// final email list:
// "daniel.bogdan@emxdigital.com, matt.friedman@emxdigital.com, michael.grosinger@emxdigital.com, nick.colletti@emxdigital.com"

function init() {
    // start up the scraper and send email when complete
    cmpscraper.scrape(function() {
        mailer.sendMail();
    });
}

init();

