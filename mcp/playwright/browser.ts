import { chromium } from "playwright";

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

await page.goto("http://localhost:5173");

export { page, browser };
