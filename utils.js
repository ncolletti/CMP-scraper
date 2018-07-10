const utils = {
    // process array of URLs with async function sync
    async processArray (array, fn, context) {
        try {
            let results = [];

            // loop through array of args and run function with it
            for (let i = 0; i < array.length; i++) {
                let bindedR = await fn.bind(context, array[i])
                let r = await bindedR();
                results.push(r);
            }
            // can return result of promise function if needed
            return results;

        } catch (err) {
            console.log(err)
        }
    },
    // stores results in our global array
    storeResults(context, {
        cmp: {
            url = 'Error storing URL',
            cmpLoaded = false,
            gdprAppliesGlobally = false,
            stub = false,
            error = false
        }
    }) {
        context.gdprStatusStore.push({
            url,
            cmpLoaded,
            gdprAppliesGlobally,
            stub,
            error
        });
    },
    // function to pause script and allow pages to load completely.
    // avoid some errors from puppeteer
    waitFor(timeToWait) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(true);
            }, timeToWait);
        });
    }
} 

module.exports = utils;
 



