const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        await page.goto('http://localhost:3000/index.html');
        await new Promise(r => setTimeout(r, 2000));
        
        // Wait for map canvas
        await page.waitForSelector('#mapCanvas');
        
        // Click at two distinct points to set start and end
        // First click
        await page.mouse.click(300, 300);
        await new Promise(r => setTimeout(r, 500));
        
        // Second click
        await page.mouse.click(500, 400);
        await new Promise(r => setTimeout(r, 1000));
        
        // Check if stats are rendered
        const statsHtml = await page.evaluate(() => document.getElementById('statPanel').innerHTML);
        console.log("Stats panel HTML:", statsHtml);
        
        await browser.close();
    } catch (e) {
        console.error(e);
    }
})();
