import { chromium } from "playwright";

let browser;
try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
} catch (e) {
    browser = await chromium.launch();
}

let context = browser.contexts()[0];

if (!context) {
    context = await browser.newContext();
}
if (!context) {
    throw new Error("No context found");
}

const page = context.pages()[0]!;

export { page, browser };
