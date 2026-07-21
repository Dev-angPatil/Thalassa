const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await page.goto('http://localhost:3000/tests/runner.html');
    await page.waitForTimeout(5000); // wait for tests
    const passCount = await page.evaluate(() => document.querySelectorAll('.pass').length);
    const failCount = await page.evaluate(() => document.querySelectorAll('.fail').length);
    console.log(`Passed: ${passCount}, Failed: ${failCount}`);
    await browser.close();
})();
