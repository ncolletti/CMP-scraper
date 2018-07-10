"use strict";

const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const csv = require('csvtojson');

var date = new Date().toLocaleDateString().replace(/^/, '-').replace(/\//g, ".")

const writer = {
    write(){
        return createCsvWriter({
            path: `${__dirname}\/cmp-scrape-results${date}.csv`,
            header: [{
                    id: 'url',
                    title: 'URL'
                },
                {
                    id: 'cmpLoaded',
                    title: 'CMP_LOADED'
                },
                {
                    id: 'gdprAppliesGlobally',
                    title: "GDPR_APPLIES_GLOBALLY"
                },
                {
                    id: 'stub',
                    title: 'CMP_STUB'
                },
                {
                    id: 'error',
                    title: 'ERROR'
                }
            ]
        })
    },

    readUrls(config) {
        let urlArray = [];
        // read csv of urls
        csv().fromFile(`${__dirname}\/${config.urlSheetName}`).then(function (urlList) {
            // dump to an array
            for (let item of urlList) {
                urlArray.push(item.urls)
            }
        })

        return new Promise(function (resolve) {
            resolve(urlArray)
        });
    }
}

module.exports = writer