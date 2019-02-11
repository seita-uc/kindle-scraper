const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const fs = require('fs');
const firebase = require('../common/firebase.js');

const pc = {
    name: 'Desktop 1920x1080',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.75 Safari/537.36',
    viewport: {
        width: 1920,
        height: 1080
    }
};
const iPad = devices['iPad Pro'];
const cookiesPath = './cookies_amazon.json';
const AMAZON_EMAIL = process.env.AMAZON_EMAIL;
const AMAZON_PASSWORD = process.env.AMAZON_PASSWORD;
const amazonKindleUrl = 'https://read.amazon.co.jp/notebook?ref_=kcr_notebook_lib';

async function login(page) {
    await page.waitFor(2000);

    await page.screenshot({path: 'images/amazon_loggingin.png'});

    const password_input = await page.$('#ap_password');
    if(password_input !== null) {
        await page.type('#ap_password', AMAZON_PASSWORD);
    }

    const email_input = await page.$('#ap_email');
    if(email_input !== null) {
        await page.type('#ap_email', AMAZON_EMAIL);
    }

    await page.click('#signInSubmit');
    await page.waitFor(5000);
    await page.screenshot({path: 'images/amazon_logined.png'});
}

async function restoreCookie(page) {
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
    for (let cookie of cookies) {
        await page.setCookie(cookie);
    }
}

async function saveCookie(page) {
    const cookies = await page.cookies();
    fs.writeFileSync('cookies_amazon.json', JSON.stringify(cookies));
}

async function scrapeBook(book, page, bookId) {
    const title = await book.$eval('.kp-notebook-searchable', (e) => {
        return e.textContent;
    });
    const src = await book.$eval('.kp-notebook-cover-image', (img) =>  {
        return img.getAttribute('src');
    });
    const newPage = page;
    await newPage.click(`#` + bookId)
    await newPage.waitForSelector('.kp-notebook-annotation-container');

    const yellowHighlights = await newPage.$$('.kp-notebook-highlight-yellow');
    const blueHighlights = await newPage.$$('.kp-notebook-highlight-blue');

    const yellowAnnotations = (await Promise.all(yellowHighlights.map((yellowHl) => {
        return yellowHl.$eval('#highlight', (span) => span.textContent)
            .then((text) => text)
            .catch((err) => undefined);
    }))).filter((e) => e !== undefined);

    const blueAnnotations = (await Promise.all(blueHighlights.map((blueHl) => {
        return blueHl.$eval('#highlight', (span) => span.textContent)
            .then((text) => text)
            .catch((err) => undefined);
    }))).filter((e) => e !== undefined);

    return {
        title: title,
        image: src,
        yellowAnnotations: yellowAnnotations,
        blueAnnotations: blueAnnotations,
    };
}


(async () => {
    const browser = await puppeteer.launch({
        headless: true,
    });

    const page = await browser.newPage();
    page.on('load', () => console.log('Page loaded'));

    console.log('Emulating device');
    await page.emulate(pc);

    console.log('Restoring cookie');
    await restoreCookie(page);

    console.log('Opening amazon kindle website');
    await page.goto(amazonKindleUrl, {waitUntil: 'load'});
    //await page.waitFor(2000);

    const password_input = await page.$('#ap_password');
    if(password_input !== null) {
        console.log('Opening amazon kindle website');
        await login(page);
    }

    const eachBookSelector = 'div.kp-notebook-library-each-book';
    await page.waitForSelector(eachBookSelector);
    const books = await page.$$(eachBookSelector);
    const booksIds = await page.$$eval(eachBookSelector, list => {
        return list.map((data) => data.id);
    });
    console.log('Book number: ' + books.length);

    let newPages = new Array();
    let pageNum = 2;
    for (let i = 0; i < pageNum; i++) {
        const newPage = await browser.newPage();
        await newPage.goto(amazonKindleUrl);
        newPages.push(newPage)
    }
    newPages.push(page);

    for (const [index, book] of books.entries()) {
        try {
            console.log(await scrapeBook(book, newPages[index%newPages.length], booksIds[index]))
        } catch (err) {
            console.error(err);
        }
    };

    console.log('Taking screenshot ...');
    await page.screenshot({path: 'images/amazon_after.png'});
    await saveCookie(page);

    browser.close();
})();
