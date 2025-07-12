import { chromium } from "playwright";

let browser;
try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
} catch (e) {
    browser = await chromium.launch();
}
const context = await browser.newContext();
const page = await context.newPage();

export { page, browser };
