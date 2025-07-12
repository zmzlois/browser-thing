import { chromium, type Browser } from 'playwright';

const browser = await chromium.connectOverCDP('ws://localhost:9222/devtools/browser/1f2ea81f-5dda-4526-832a-761de2c5da4e');

let context = browser.contexts()[0]!;

if (browser.contexts().length <= 0) {
    throw new Error('No context is currently open.');
}

const first = context.pages()?.[0]!;
const isInspectorOpen = (await first.title()).includes("DevTools");

const ACTIVE_TAB = 0;

const page = context.pages()?.[isInspectorOpen ? ACTIVE_TAB : ACTIVE_TAB]!;

export { page, browser };