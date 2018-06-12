"use strict";

const readline = require('readline');
const puppeteer = require("puppeteer");
//const async = require('async');
const fs = require('fs');
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// config to write to a csv
const csvWriter = createCsvWriter({
    path: `${__dirname}\\cmp-scrape-results.csv`,
    header: [
        { id: 'url', title: 'URL' },
        { id: 'cmpStatus', title: 'CMP_STATUS'},
        { id: 'cmpLoaded', title: 'CMP_LOADED'},
        { id: 'gdprAppliesGlobally', title: "GDPR_APPLIES_GLOBALLY"}
    ]
});

// default proxy server
var PROXY_SERVER = "http://88.99.12.165:80";

// temp testing fake proxy URL
//PROXY_SERVER = 'http://12.12.12.12:80';

// store user inputted domain list 
var urlArray = [];
var status = [];

// launch browser with proxy
let browser;
async function launchPuppeteer(proxy) {
    console.log(`Connecting to Chrome with proxy url: ${proxy}`);

    // launch browser
    browser = await puppeteer.launch({

        // can launch to see window by changing this
        headless: false,
        // proxy here. can either use http or socks5
        // can also use an auth with user:pass@ or await page.authenticate(user, pass)
        //--proxy-server=socks5://136.243.218.19:1080',
        //http://88.99.12.165:80

        args: [`--proxy-server=${proxy}`,
            '--ignore-certificate-errors'
        ]
    });

    // test proxy server connection
    const page = await browser.newPage();

    // // check for errors
    // page.on('error', msg => {
    //     console.log(`here is the error ${msg}`);
    // })
    
    try {
        // go to a url
        await page.goto('http://brealtime.com/');
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

            rl.question('Enter a new proxy IP and port as a string in this format (\"http|socks5://ip:port\"): ', function (proxy) {

                // try again with new proxy from user
                launchPuppeteer(proxy);

                rl.close();
            })
        });
        
    }
    
}

launchPuppeteer(PROXY_SERVER);

// function to check CMP status using Puppeteer
async function checkUrlCmpStatus(currentUrl) {
    
    console.log(`Checking ${currentUrl}...`)

    // local variable to hold gdpr status
    var gdprStatus = '';

    // open new tab for current url
    const page = await browser.newPage();

    // navigate to current URL
    await page.goto(currentUrl);

    // watches console throughout session and if there is a console.log with gdpr included then let's grab it and save it
    page.on('console', msg => {
        if (msg._text.indexOf('gdpr') !== -1) {
            gdprStatus = JSON.parse(msg._text)
        }
    })

    // not needed but want to be sure we are getting desktop pages
    await page.setViewport({
        width: 1024,
        height: 768
    });

    // not needed but want to be sure everything loads properly
    await page.waitFor(1000);

    // ensure we have the window context in our headless page session
    const windowHandle = await page.evaluateHandle('window');

    // ping the CMP and get the results of their GDPR status. If this retuns emtpy then there is no CMP.
    try {
        await page.evaluate(window => window.__cmp ? window.__cmp('ping', null, function (data) {
            // display results of the CMP ping method in the headless console
            console.log(JSON.stringify(data))
        }) : console.log(`no CMP`), windowHandle)
    } catch (e) {
        console.log(e)
    }

    // store results into object
     status.push({
         'url': currentUrl,
         'cmpStatus': typeof gdprStatus === 'object' ? 'Exists' : 'None',
         'cmpLoaded': gdprStatus.cmpLoaded || 'No',
         'gdprAppliesGlobally': gdprStatus.gdprAppliesGlobally || 'No'
     })

    // display results to the user
    if (gdprStatus.cmpLoaded) {
        console.log(`The URL ${currentUrl} has a CMP that is loaded and a GDPR global status set to: ${gdprStatus.gdprAppliesGlobally}`)
    } else {
        console.log(`The URL ${currentUrl} does not have a CMP loaded.`)
    }

    await page.close();

    // not needed but want to be sure everything closes properly
    await page.waitFor(1000);
}

// process array of URLs with async function sync
async function processArray(array, fn) {
    let results = [];

    // loop through array of args and run function with it
    for (let i = 0; i < array.length; i++) {
        let r = await fn(array[i]);
        results.push(r);
    }
    // can return result of promise function if needed
    return results;
}

function getCmpUrls() {
    // get user input for list of domains
    rl.question('Enter a list of URL strings comma separated: ', function (urls) {
        // convert to array and display
        urlArray = urls.split(',');

        processArray(urlArray, checkUrlCmpStatus).then(async function (result) {
            // all done
            browser.close();

            // confirm completed list and display obj with results
            console.log(`All URLs have been scanned. Here are the results: `)
            console.log(status);

            // write to results to csv
            await csvWriter.writeRecords(status).then(() => console.log('Completed scrape. Results dumped to csv'));

            process.exit();

        }, function (err) {
            // an error occured
            console.log(err)
        });

        rl.close();
    })
}





