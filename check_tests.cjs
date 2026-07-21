const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.goto('http://localhost:3000/tests/runner.html', { waitUntil: 'networkidle2' });
        
        // Wait for tests to finish running
        await page.waitForFunction(() => {
            const stats = document.getElementById('stats');
            return stats && stats.innerText.includes('(Done)');
        }, { timeout: 10000 });
        
        const statsText = await page.$eval('#stats', el => el.innerText);
        const results = await page.$$eval('#results li', lis => lis.map(li => li.innerText.replace(/\n/g, ' ')));
        
        console.log('STATS:', statsText);
        console.log('RESULTS:');
        results.forEach((r, i) => console.log(`${i+1}: ${r}`));
        
        await browser.close();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
