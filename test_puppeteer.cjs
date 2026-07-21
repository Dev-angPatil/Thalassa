const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        await page.goto('http://localhost:3000/tests/runner.html');
        await new Promise(r => setTimeout(r, 3000));
        const bodyText = await page.evaluate(() => document.body.innerText);
        console.log("Body:", bodyText);
        const hasPassed = bodyText.includes('All tests passed!');
        const passCount = await page.evaluate(() => document.querySelectorAll('.pass').length);
        const failCount = await page.evaluate(() => document.querySelectorAll('.fail').length);
        console.log(`Passed: ${passCount}, Failed: ${failCount}`);
        await browser.close();
    } catch (e) {
        console.error(e);
    }
})();
