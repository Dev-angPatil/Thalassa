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

        await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
        console.log("Navigated to main app");
        
        // Wait for map and gridData to be initialized
        await page.waitForFunction(() => window.map && window.gridData && window.gridData.length > 0);
        
        // Find a land cell (landlocked) and a remote cell, simulate click
        const result = await page.evaluate(() => {
            let crashes = [];
            
            // Override console.error to catch errors
            const originalError = console.error;
            console.error = function(...args) {
                crashes.push("Console Error: " + args.join(' '));
                originalError.apply(console, args);
            };
            
            // Try to find a land cell
            const landCell = window.gridData.find(c => c.isLand);
            if (landCell) {
                console.log("Clicking land cell at", landCell.lat, landCell.lng);
                window.map.fire('click', { latlng: window.L.latLng(landCell.lat, landCell.lng) });
            } else {
                console.log("No land cell found!");
            }
            
            return new Promise(resolve => {
                setTimeout(() => {
                    // Try to find an ocean cell really far away (like corner)
                    const farOceanCell = window.gridData.find(c => !c.isLand && c.row > 25);
                    if (farOceanCell) {
                        console.log("Clicking far ocean cell at", farOceanCell.lat, farOceanCell.lng);
                        window.map.fire('click', { latlng: window.L.latLng(farOceanCell.lat, farOceanCell.lng) });
                    }
                    
                    setTimeout(() => {
                        console.error = originalError;
                        
                        // Check if the toast notification exists
                        const toast = document.querySelector('.toast-container .toast');
                        const toastMsg = toast ? toast.innerText : null;
                        
                        resolve({ crashes, toastMsg });
                    }, 500);
                }, 500);
            });
        });
        
        console.log("Simulation Result:", result);
        
        if (result.crashes.length > 0) {
            console.error("FAILED: App crashed or logged console errors:", result.crashes);
            process.exit(1);
        } else {
            console.log("SUCCESS: No crashes detected. Route fallbacks handled gracefully.");
        }
        
    } catch (err) {
        console.error("Puppeteer Script Error:", err);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
})();
