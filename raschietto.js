const { Telegraf } = require('telegraf');
const playwright = require('playwright');

async function main() {
    const browser = await playwright.chromium.launch({
        headless: true
    });
    
    const page = await browser.newPage();
    await page.goto(process.env.URL_TO_SCRAPE);
    const productsContainerHandle = await page.waitForSelector('.products');
    const productsHandle = await productsContainerHandle.$$('div[id^="product-"]');
    const productsStock = [];
    for await (p of productsHandle) {
        const productName = await p.$eval('h3', node => node.innerText);
        let inStock = false;
        
        try {
            inStock = await p.$eval('div.product-price', node => true);
        } catch (_) {
            // if not in stock the product-price class is missing throwing an error
            // but we want to continue 
        }

        productsStock.push({
            name: productName,
            inStock 
        });
    }
    await browser.close();

    const bot = new Telegraf(process.env.RASCHIETTO_BOT_TOKEN);

    const msg = productsStock.map(p => {
        return `${p.name}: ${p.inStock ? '🚨 **In Stock** 🚨' : '~~Not In Stock~~'}`;
    }).join('\n');

    bot.telegram.sendMessage(process.env.CHAT_ID, msg, { parse_mode: 'MarkdownV2' });

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main();
