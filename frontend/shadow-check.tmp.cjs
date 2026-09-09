const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Users\\Computer01\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe', headless: true });
  const page = await browser.newPage();
  await page.goto('file:///C:/Users/COMPUT~1/AppData/Local/Temp/opencode/shadow-test.html');
  const result = await page.evaluate(() => {
    const host = document.getElementById('host');
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const innerFont = getComputedStyle(host.shadowRoot.querySelector('.inner')).fontSize;
    const shadowBody = host.shadowRoot.querySelector('body');
    return { bodyBg, innerFont, hasShadowBody: !!shadowBody, shadowHtml: host.shadowRoot.innerHTML };
  });
  console.log('RESULT:', JSON.stringify(result, null, 2));
  await browser.close();
})();
