"use strict";

const utils = require('./utils');
const writer = require('./writer');
const puppeteer = require("puppeteer");
const config = require('./config.json');

const scraper = {
    urlArray: [],
    gdprStatusStore: [],
    browser: '',
    utils: utils,
    cb: '',
    scrape(callback) {
        // set the email function as final callback
        this.cb = callback;

        writer.readUrls(config).then(function (urls) {
            scraper.urlArray = urls;
        }).catch(function (err) {
            console.log(err);
        })

        if (config.skipProxyCheck){
            this.launchPuppeteer(config);
            
            // temporary. ideally i want to chain scanUrlList from launchPuppeteer function. I'm having trouble returning this to
            // do a method chain here. Not sure why yet.
            // this.launchPuppeteer(config).scanUrlList().then(() => callback());

        } else {
            let isProxyWorking = this.proxyCheck(config.proxy);
            
            if (isProxyWorking) {
                this.launchPuppeteer(config);
            } else {
                console.log(`Proxy error! Please restart with a new proxy URL in your config.`)
                return false;
            }
        }
        
    },
    // function to check CMP status using Puppeteer
    async checkUrlCmpStatus(currentUrl) {
        try {            
            console.log(`Checking ${currentUrl}...`)
            // object to hold gdpr status
            let status = {
                cmp: {
                    url: currentUrl
                }
            };
            // open new tab for current url
            const page = await this.browser.newPage();

            // navigate to current URL
            try {
                await page.goto(currentUrl, {
                    waitUntil: 'domcontentloaded'
                });
            } catch (err) {
                console.log(`error navigating ${err}`)
                utils.storeResults(this, {
                    cmp: {
                        url: currentUrl,
                        error: err
                    }
                })

                await page.close();
            }

            // watches console throughout session and if there is a console.log with gdpr included then let's grab it and save it
            page.on('console', function (msg) {
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
            await this.utils.waitFor(2000);

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
                await page.evaluate(function (window) {
                    (typeof window.__cmp === 'function') ? window.__cmp('ping', null, function (data) {
                        // display results of the CMP ping method in the headless console
                        console.log(JSON.stringify(data))
                    }): console.log(`no CMP`)
                }, windowHandle)

            } catch (err) {
                console.log(`page evaluate failed with error ${err}`);
                this.utils.storeResults(this, {
                    cmp: {
                        url: page.url(),
                        error: err
                    }
                })

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

            await this.utils.storeResults(this, status);

            // **update: turns out we don't need this step. works properly without.
            //await page.waitFor(1000);
        } catch (err) {
            console.log(err)
        }

    },
    async proxyCheck(proxy) {

            try {
                // go to a url
                await page.goto('http://brealtime.com/', {
                    waitUntil: 'domcontentloaded'
                });

                console.log('The proxy is working, were connected!')

                await page.close();

                return true;

            } catch (e) {

                await this.browser.close();

                console.log('error loading proxy check page! ', e);
                return false;
            }

    },
    async launchPuppeteer(config) {
        console.log(`Connecting to Chrome with proxy url: ${config.proxy}`);

        // launch browser
        this.browser = await puppeteer.launch({
            headless: config.headless,
            args: [`--proxy-server=${config.proxy}`,
                '--ignore-certificate-errors',
                '--no-sandbox',
                '--diable-setuid-sandbox'
            ],
            ignoreHTTPSErrors: true
        });

        this.scanUrlList();
    },
    async scanUrlList() {
        utils.processArray(this.urlArray, this.checkUrlCmpStatus, this).then(async function () {
            

            // confirm completed list and display obj with results
            console.log(`All URLs have been scanned. Here are the results: `)
            console.log(scraper.gdprStatusStore);

            // write to results to csv
            await writer.write().writeRecords(scraper.gdprStatusStore).then(() => console.log('Completed scrape. Results dumped to csv'));

            // all done
            await scraper.browser.close();

            // email callback
            await scraper.cb();

        }, function (err) {
            // an error occured
            console.log(err)

        }).catch(err => {
            // error with processArray
            console.log(err)
        });
    }
}

module.exports = scraper;