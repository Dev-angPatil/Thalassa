const puppeteer = require('puppeteer');

(async () => {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => {
            console.error('PAGE ERROR:', error.message);
        });

        // Navigate to the dashboard
        await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
        console.log("Navigated to Thalassa Map Dashboard.");

        // Wait for map layers to render
        await new Promise(r => setTimeout(r, 3000));

        // Check for presence of the fish-cluster-hull SVG class drawn by Leaflet
        const clusterHullsCount = await page.evaluate(() => {
            const hulls = document.querySelectorAll('.fish-cluster-hull');
            return hulls.length;
        });

        console.log(`Verification: Found ${clusterHullsCount} active ML cluster hulls rendered on the Leaflet map.`);

        if (clusterHullsCount > 0) {
            console.log("SUCCESS: Dynamic ML clusters successfully loaded from backend and visualized as Convex Hulls.");
            await browser.close();
            process.exit(0);
        } else {
            console.error("FAILED: No cluster hulls rendered on the map.");
            await browser.close();
            process.exit(1);
        }

    } catch (err) {
        console.error("Puppeteer script execution error:", err);
        if (browser) await browser.close();
        process.exit(1);
    }
})();
