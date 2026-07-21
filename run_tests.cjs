const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  let testsFailed = false;

  page.on('console', msg => {
    const text = msg.text();
    console.log(text);
    if (text.includes('Tests Failed')) {
      testsFailed = true;
    }
  });

  await page.goto('http://localhost:3000/tests/runner.html', { waitUntil: 'networkidle0' });
  
  // Wait a bit to ensure tests complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const results = await page.evaluate(() => {
    return document.body.innerText;
  });
  
  console.log("Page Content:");
  console.log(results);
  
  await browser.close();
  
  if (testsFailed || results.includes('Failed')) {
    process.exit(1);
  }
})();
