// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/).
import { Actor } from 'apify';
// Web scraping and browser automation library (Read more at https://crawlee.dev)
import { PuppeteerCrawler } from 'crawlee';

// Import the specialized Allianz router
import { allianzRouter } from './allianz-routes.js';

// The init() call configures the Actor for its environment. It's recommended to start every Actor with an init().
await Actor.init();

// Define the URLs to start the crawler with - get them from the input of the Actor or use the Allianz URL as default.
const input = await Actor.getInput();
const startUrls = input?.startUrls || [{ url: 'https://www.allianz.de/auto/kfz-versicherung/rechner/' }];

// Create a proxy configuration that will rotate proxies from Apify Proxy.
const proxyConfiguration = await Actor.createProxyConfiguration();

// Create a PuppeteerCrawler that will use the proxy configuration and handle requests with the Allianz router.
const crawler = new PuppeteerCrawler({
    proxyConfiguration,
    requestHandler: allianzRouter,
    launchContext: {
        launchOptions: {
            headless: false, // Set to true for production, false for debugging
            args: [
                '--disable-gpu', // Mitigates the "crashing GPU process" issue in Docker containers
                '--no-sandbox', // Mitigates the "sandboxed" process issue in Docker containers
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ],
        },
    },
    maxRequestsPerCrawl: 1, // Only process the Allianz form
});

// Run the crawler with the start URLs and wait for it to finish.
await crawler.run(startUrls);

// Gracefully exit the Actor process. It's recommended to quit all Actors with an exit().
await Actor.exit();
