"use strict";

const utils = require('./utils');
const readline = require('readline');
const puppeteer = require("puppeteer");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const csv = require('csvtojson');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var urlArray = [];

// read csv of urls
csv().fromFile(`${__dirname}\/toscrape.csv`).then(function (urlList) {
    // dump to an array
    for (let item of urlList) {
        urlArray.push(item.urls)
    }

    // start scanning
    launchPuppeteer(PROXY_SERVER);
})

// config to write to a csv
const csvWriter = createCsvWriter({
    path: `${__dirname}\/cmp-scrape-results.csv`,
    header: [
        { id: 'url', title: 'URL' },        
        { id: 'cmpLoaded', title: 'CMP_LOADED'},
        { id: 'gdprAppliesGlobally', title: "GDPR_APPLIES_GLOBALLY"},
        { id: 'stub', title: 'CMP_STUB'},
        { id: 'error', title: 'ERROR'}
    ]
});

// default proxy server
var PROXY_SERVER = "http://88.99.12.165:80";

// temp testing fake proxy URL
//PROXY_SERVER = 'http://12.12.12.12:80';

// store user inputted domain list 
//var urlArray = [];
var gdprStatusStore = [];

// launch browser with proxy
let browser;

async function launchPuppeteer(proxy) {
    console.log(`Connecting to Chrome with proxy url: ${proxy}`);

    // launch browser
    browser = await puppeteer.launch({

        // can launch to see window by changing this
        //headless: false,
        // proxy here. can either use http or socks5
        // can also use an auth with user:pass@ or await page.authenticate(user, pass)
        //--proxy-server=socks5://136.243.218.19:1080',
        //http://88.99.12.165:80

        args: [`--proxy-server=${proxy}`,
            '--ignore-certificate-errors',
            // used for brt data jobs ubuntu box below
            '--no-sandbox', 
            '--diable-setuid-sandbox'
        ],
        ignoreHTTPSErrors: true
        //,timeout: 500000
    });
    
    // option to skip proxy check
    var skip = false;
    process.argv.forEach(async function(val) {
        if (val === 'skip') {
            skip = true;
        } 
    });

    if (!skip) {
        // test proxy server connection
        const page = await browser.newPage();

        try {    
            // go to a url
            await page.goto('http://brealtime.com/', { waitUntil: 'domcontentloaded' });
            // if no errors we continue to ask the user for a list of CMP urls to check
            console.log('The proxy is working, were connected!')

            await page.close();

            getCmpUrls();

        } catch (e) {
            // issue with proxy or loading the page
            //console.log(e);

            await browser.close().then(() => {
                console.log('Default proxy is not working. You can retry once more before restarting this script.');
                console.log("Here is a list of proxy server urls: http://spys.one/free-proxy-list/DE/");

                rl.question('Enter a new proxy IP and port (http|socks5://ip:port): ', function (proxy) {

                    // try again with new proxy from user
                    launchPuppeteer(proxy);

                    rl.close();
                })
            });

        }

    } else {
        // choosing to skip proxy check and go straight to check URLs
        getCmpUrls();
    }
}

// stores results in our global array
function storeResults({
    cmp: {
        url = 'Error storing URL',
        cmpLoaded = false,
        gdprAppliesGlobally = false,
        stub = false,
        error = false
    }
}) {
    gdprStatusStore.push({
        url,
        cmpLoaded,
        gdprAppliesGlobally,
        stub,
        error
    });
}

// function to check CMP status using Puppeteer
async function checkUrlCmpStatus(currentUrl) {
    try {
        console.log(`Checking ${currentUrl}...`)

        // object to hold gdpr status
        var status = {cmp:{url: currentUrl}};

        // open new tab for current url
        const page = await browser.newPage();

        // navigate to current URL
        try {
            await page.goto(currentUrl, { waitUntil: 'domcontentloaded' });
        } catch (err) {
            console.log(`error navigating ${err}`)
            storeResults({cmp:{url: currentUrl, error: err}})

            await page.close();
        }

        // watches console throughout session and if there is a console.log with gdpr included then let's grab it and save it
        page.on('console', function(msg) {
            // normal cmp and stub cmp results
            if (msg._text.indexOf('gdpr') !== -1) {
                var cmp = JSON.parse(msg._text)
                status.cmp.cmpLoaded = cmp.cmpLoaded
                status.cmp.gdprAppliesGlobally = cmp.gdprAppliesGlobally
            }
        })

        // make sure we are getting desktop pages
        await page.setViewport({
            width: 1024,
            height: 768
        });

        // make sure everything loads properly
        await page.waitFor(1000);

        // may need to wait longer to avoid issues
        await utils.waitFor(2000);

        // ensure we have the window context in our headless page session
        const windowHandle = await page.evaluateHandle('window');

        // ping the CMP and get the results of their GDPR status. If this retuns emtpy then there is no CMP.
        try {

            // try to find a cmp via IFRAME stub method.
            await page.$("iframe[name='__cmpLocator']").then((result) => {
                // if it's on the page let's log it
                if (result != null) {
                    status.cmp.stub = true;
                }
            })

            // check if there the IAB __cmp() function exists on the page
            await page.evaluate(function(window) {
                (typeof window.__cmp === 'function') ? window.__cmp('ping', null, function (data) {
                    // display results of the CMP ping method in the headless console
                    console.log(JSON.stringify(data))
                }) : console.log(`no CMP`)
            }, windowHandle)

        } catch (err) {
            console.log(`page evaluate failed with error ${err}`);
            storeResults({cmp:{ url: page.url(), error: err }})

            await page.close();
        }

        //display results to the user
        if (status.cmp.cmpLoaded != undefined || status.cmp.stub === true) {
          console.log(`The URL ${currentUrl} has a CMP that is on the page.`);
        } else {
          console.log(`The URL ${currentUrl} does not have a CMP on the page.`);
        }

        await page.close();

        console.log(JSON.stringify(status))

        await storeResults(status);

    // **update: turns out we don't need this step. works properly without.
    //await page.waitFor(1000);
    } catch (err) {
        console.log(err)
    }
    
}

// process array of URLs with async function sync
async function processArray(array, fn) {
    try {
        let results = [];

        // loop through array of args and run function with it
        for (let i = 0; i < array.length; i++) {
            let r = await fn(array[i]);
            results.push(r);
        }
        // can return result of promise function if needed
        return results;

    } catch (err) {
        console.log(err)
    }
}


function getCmpUrls() {
    // reactivate this if you want to input a URL instead of using csv
    // get user input for list of domains

    //rl.question('Press enter'/*'Enter a list of URL strings comma separated: */, function (urls) {
        // convert to array and display
        //urlArray = urls.split(',');

        processArray(urlArray, checkUrlCmpStatus).then(async function () {
            // all done
            browser.close();

            // confirm completed list and display obj with results
            console.log(`All URLs have been scanned. Here are the results: `)
            console.log(gdprStatusStore);

            // write to results to csv
            await csvWriter.writeRecords(gdprStatusStore).then(() => console.log('Completed scrape. Results dumped to csv'));

            process.exit();

        }, function (err) {
            // an error occured
            console.log(err)

            process.exit();

        }).catch(err => {

            console.log(err)

            process.exit();
        });

        rl.close();
    //})
}





