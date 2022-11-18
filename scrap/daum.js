const _ = require("lodash");
const { installMouseHelper } = require("../libs/install-mouse-helper");
const puppeteer = require('puppeteer-core');
const URL = "https://news.daum.net/breakingnews";

const SERVICENAME = "daum";
const fs = require('fs')

function splitArray(candid) {
    var oddOnes = [],
        evenOnes = [];
    for (var i = 0; i < candid.length; i++)
        (i % 2 == 0 ? evenOnes : oddOnes).push(candid[i]);
    return oddOnes;
}

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(URL);
    await installMouseHelper(page);
    page.setDefaultNavigationTimeout(30000);

    let article_href = await page.$$eval(
        "#mArticle > div.box_etc > ul a",
        (linklist) => linklist.map((e) => e.getAttribute("href"))
    );

    article_hrefs = splitArray(article_href)

    let dataset = {
        "links": [],
        "data": []
    }

    for (let i = 0; i < article_hrefs.length; i++) {
        await page.goto(article_hrefs[i]);
        const htmls = await page.evaluate(() => document.querySelector('#mArticle').outerHTML);
        dataset.data.push(htmls)
        dataset.links.push(article_hrefs[i])
    }

    // const data = JSON.stringify(dataset)
    // fs.writeFile('../user.json', data, err => {
    //     if (err) {
    //         throw err
    //     }
    //     console.log('JSON data is saved.')
    // })

    const currentTime = new Date();
    console.log(`wait start ${index} currentHour: ${currentTime}`);

})();
