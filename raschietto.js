require('dotenv').config();
const { Telegraf } = require('telegraf');
const playwright = require('playwright');
const crypto = require('crypto');
const { readFileSync, writeFileSync, existsSync } = require('fs');

const urlToScrape = process.env.URL_TO_SCRAPE;
const raschiettoBotToken = process.env.RASCHIETTO_BOT_TOKEN;
const chatId = process.env.CHAT_ID;
const stockOfProductsChecksumFile = 'stocksOfProductsChecksum.txt';

async function main() {
    const browser = await playwright.chromium.launch({
        headless: true
    });
    
    const page = await browser.newPage();
    await page.goto(urlToScrape);
    const productsContainerHandle = await page.waitForSelector('.products');
    const productsHandle = await productsContainerHandle.$$('div[id^="product-"]');
    const products = [];
    for await (p of productsHandle) {
        const productName = await p.$eval('h3', node => node.innerText);
        const productPath = await p.$eval('a', node => node.getAttribute('href'));
        let productPrice = undefined;
        try {
            productPrice = await p.$eval('div.product-price > h3', node => node.innerText);
        } catch (_) {
            // if not in stock the product-price class is missing throwing an error
            // but we want to continue 
        }
        products.push({
            name: productName,
            path: productPath,
            price: productPrice 
        });
    }
    await browser.close();

    const bot = new Telegraf(raschiettoBotToken);
    const baseUrl = new URL(urlToScrape).origin;
    const msg = products.map(p => {
        return `${p.price ? `🚨 <a href="${new URL(p.path, baseUrl)}">${p.name} - ${p.price}</a> 🚨` : `<del>${p.name}</del>`}`;
    }).join('\n');

    const currentStockOfProductsMd5 = crypto.createHash('md5').update(msg).digest("hex");

    if (!existsSync(stockOfProductsChecksumFile)) {
        console.info('Checksum file does not exists, sending first update');
        // write to the file
        writeFileSync(stockOfProductsChecksumFile, currentStockOfProductsMd5);
        // send the msgs
        bot.telegram.sendMessage(chatId, msg, { parse_mode: 'HTML', disable_web_page_preview: true });
    } else {
        // read the prev value of file
        const pervStockOfProductsMd5 = readFileSync(stockOfProductsChecksumFile).toString();
        // compare the md5
        if (currentStockOfProductsMd5 != pervStockOfProductsMd5) {
            console.info('Checksum changed, sending update');
            writeFileSync(stockOfProductsChecksumFile, currentStockOfProductsMd5);
            bot.telegram.sendMessage(chatId, msg, { parse_mode: 'HTML', disable_web_page_preview: true });
        } else {
            console.info('Checksum did not change');
        }
    }

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main();
