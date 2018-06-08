"use strict";

const readline = require('readline');
const puppeteer = require("puppeteer");
const async = require('async');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// store user inputted domain list 
var urlArray = [];
var status = [];

// launch browser with proxy
let browser;
async function launchPuppeteer() {
    browser = await puppeteer.launch({
        // can launch to see window by changing this
        headless: false,
        // proxy here. can either use http or socks5
        // can also use an auth with user:pass@ or await page.authenticate(user, pass)
        //--proxy-server=socks5://136.243.218.19:1080',

        //TODO: have the proxy server a variable set from CLI arg
        args: ['--proxy-server=http://88.99.12.165:80',
            '--ignore-certificate-errors'
        ]
    });
}

launchPuppeteer()

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
         'cmpLoaded': gdprStatus.cmpLoaded || 'None',
         'gdprAppliesGlobally': gdprStatus.gdprAppliesGlobally || 'None'
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

// get user input for list of domains
rl.question('Enter a list of URL strings comma separated: ', function(urls) {
    // convert to array and display
    urlArray = urls.split(',');

    // loop through each url sync and run callback when completed
    async.each(urlArray, checkUrlCmpStatus, function(err) {
        if (err) console.log(err)
        // confirm completed list and display obj with results

        //TODO: return results in a csv file and write to disk
        console.log(`All URLs have been scanned. Here are the results: `)
        console.log(status);
    })

    rl.close();
})




