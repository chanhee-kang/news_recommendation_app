const JSONHEADER = { "Content-Type": "application/json" };
const fetch = require("node-fetch");
const queryString = require("query-string");
const SERVERADDRESS = "http://localhost:8000";
const puppeteer = require("puppeteer");
const _ = require("lodash");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const moment = require("moment");
const { min, first } = require("lodash");
const { installMouseHelper } = require("../libs/install-mouse-helper");


const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0a2NwcWxzd3pmYmJmaXhiZ3JpIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NjU2NTAxNTUsImV4cCI6MTk4MTIyNjE1NX0.gxOntaHt5K9DRTD0drelZjeCsZqC5rmNAN9RSLbz7_8'
const SUPABASE_URL = "https://wtkcpqlswzfbbfixbgri.supabase.co"

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function PostArticle(servicename, href, outerHTML, items, section) {
    const SERVER = `${SERVERADDRESS}/apiv1/${servicename}/article`;

    console.log("PostArticle:", href);
    const response = await fetch(SERVER, {
        method: "post",
        body: JSON.stringify({ href, article: outerHTML, items, section }),
        headers: JSONHEADER,
    });

    if (!response.ok) {
        throw Error("????" + response.statusText);
    }
}

async function DowPostArticle(servicename, href, outerHTML, items, guid) {
    const SERVER = `${SERVERADDRESS}/apiv1/${servicename}/article`;

    console.log("PostArticle:", href);
    const response = await fetch(SERVER, {
        method: "post",
        body: JSON.stringify({ href, article: outerHTML, items, guid }),
        headers: JSONHEADER,
    });

    if (!response.ok) {
        throw Error("????" + response.statusText);
    }
}


async function PostTraceArticle(servicename, href, outerHTML, items) {
    const SERVER = `${SERVERADDRESS}/apiv1/${servicename}/article_trace`;

    console.log("PostTraceArticle:", href);
    const response = await fetch(SERVER, {
        method: "post",
        body: JSON.stringify({ href, article: outerHTML, items }),
        headers: JSONHEADER,
    });

    if (!response.ok) {
        throw Error("????" + response.statusText);
    }
}

async function deleteClass(querySelectors, del_page) {
    let hrefs = [];
    let delete_hrefs;

    for (let i = 0; i < querySelectors.length; i++) {
        try {
            let delete_hrefs = await del_page.$$eval(querySelectors[i], (linklist) =>
                linklist.map((e) => e.getAttribute("href"))
            );

            hrefs = _.concat(hrefs, delete_hrefs);
        } catch (error) { }
    }

    hrefs = _.uniq(hrefs);

    return hrefs;
}

async function loginCookies(service, page) {
    const cookies = await page.cookies();
    const cookieJson = JSON.stringify(cookies);

    fs.writeFileSync(`./cookies/${service}.json`, cookieJson);
    console.log(`${service}쿠키저장완료`);
}

const QUERYSERVER = `${SERVERADDRESS}/apiv1/scrap/needscrap`;
const QUERYSERVER2 = `${SERVERADDRESS}/apiv1/scrap/needscrap2`;

const NEEDSCRAPOK = `"OK"`;

let wsjpro_existed_article = [];

async function dowjonesDownloadArticle(service, browser, url, items, guid) {
    const URL = queryString.stringifyUrl({
        url: QUERYSERVER2,
        query: { dowguid: guid, href: url },
    });
    const response = await fetch(URL);
    if (response.ok) {
        const needscrap = await response.text();
        if (needscrap === NEEDSCRAPOK) {
            console.log("------------download", url, items, guid);
            let newpage = null;
            try {
                newpage = await browser.newPage();
                await newpage.waitForTimeout(2000);
                try {
                    await newpage.goto(url, { timeout: 15000 });

                } catch (error) {
                    console.log("dowjonesDownloadArticle function link page goto error");
                }
                await newpage.waitForTimeout(5000);


                const outerHTML = await newpage.evaluate(
                    () => document.querySelector("*").outerHTML
                );
                await newpage.waitForTimeout(2000);
                if (_.isNil(outerHTML)) {
                    console.error(`${service} outerHTML 비어있는지 test중`);
                }

                await newpage.close();
                newpage = null;

                await DowPostArticle(service, url, outerHTML, items, guid);

            } catch (error) {
                console.error(`${url} download error \n ${error}`);
                if (newpage) {
                    await newpage.close();
                }
            }
        }
    }
    else {
        // console.error("dowjones downloadArticle QUERYSERVER Error");
    }
}

async function downloadArticle(service, browser, url, items, section) {
    const URL = queryString.stringifyUrl({
        url: QUERYSERVER,
        query: { href: url },
    });
    const response = await fetch(URL);
    if (response.ok) {
        const needscrap = await response.text();
        if (needscrap === NEEDSCRAPOK) {
            console.log("------------download", url, items, section);
            let newpage = null;
            try {
                newpage = await browser.newPage();

                await newpage.waitForTimeout(2000);
                try {
                    await newpage.goto(url, { timeout: 15000 });

                } catch (error) {
                    console.log("downloadAtricle function link page goto error");
                }
                await newpage.waitForTimeout(5000);

                const outerHTML = await newpage.evaluate(
                    () => document.querySelector("*").outerHTML
                );
                await newpage.waitForTimeout(2000);
                if (_.isNil(outerHTML)) {
                    console.error(`${service} outerHTML 비어있는지 test중`);
                }

                await newpage.close();
                newpage = null;
                await PostArticle(service, url, outerHTML, items, section);
            } catch (error) {
                console.error(`${url} download error \n ${error}`);
                if (newpage) {
                    await newpage.close();
                }
            }
        }
    } else {
        console.error("downloadArticle QUERYSERVER Error");
    }
}

async function traceArticle(service, browser, items) {
    //"select href,trace_end from article_scraped where site='barrons' and trace_end is not null";
    //let timestamp = + new Date();
    let timestamp = moment();

    //service = "test";
    let { data: article_scraped, error } = await supabase
        .from("article_scraped")
        .select("href,trace_end,id")
        .eq("site", service)
        .not("trace_end", "is", null);
    // .filter('trace_end'.isNotNull)

    if (!_.isEmpty(article_scraped)) {
        // trace할 article이 있는지 확인.
        for (let i = 0; i < article_scraped.length; i++) {
            if (timestamp.isBefore(article_scraped[i].trace_end)) {
                //만약 trace할 article이있고, trace_end time이 24시간이 지나지 않았다면,
                // send해라
                url = article_scraped[i].href;
                console.log("------------TraceArticledownload", url, items);
                //let newpage = null;
                try {
                    const newpage = await browser.newPage();
                    await newpage.waitForTimeout(2000);
                    try {
                        await newpage.goto(url, { timeout: 15000 });
                        if (service === "nikkeiasia") {
                            await newpage.waitForSelector(".ezrichtext-field");
                        }
                    } catch (error) {
                        console.error(`${service} trace 실패 url: ${url}`);
                    }
                    await newpage.waitForTimeout(5000);
                    if (service === "yahoofinance") {
                        try {
                            const storycontinue_button =
                                "button.link.rapid-noclick-resp.caas-button.collapse-button";
                            await newpage.click(storycontinue_button);
                            await newpage.waitForTimeout(2000);
                        } catch (error) {
                            //console.error(`${service} story continued click 실패`)
                        }
                    } else if (service === "scmp") {
                        try {
                            try {
                                const closeButton = "a.q4k23w-0.jdaqBK.jhbk6r-1.lcuwvm";
                                const textContent = await page.evaluate(() => {
                                    return document.querySelector(closeButton);
                                });
                                if (textContent) {
                                    await newpage.click(closeButton);
                                    await newpage.waitForTimeout(2000);
                                }
                            } catch (error) { }
                            const pageclick = ".info__headline.headline";
                            await newpage.click(pageclick);
                            for (let i = 0; i < 7; i++) {
                                // PageDown 횟수 설정 (SCMP페이지는 보이는 부분만 loading되기때문에, 스크롤을 끝까지 내려줘야함)
                                await newpage.waitForTimeout(1000);
                                await newpage.keyboard.press("PageDown");
                            }
                            await newpage.waitForTimeout(3000);
                        } catch {
                            console.log(`${service} error`);
                        }
                    }

                    const outerHTML = await newpage.evaluate(
                        () => document.querySelector("*").outerHTML
                    );
                    await newpage.waitForTimeout(2000);

                    await newpage.close();
                    //newpage = null;
                    await PostTraceArticle(service, url, outerHTML, items);
                } catch (error) {
                    console.error(`${url} Tracedownload error ${error}`);
                    // if (newpage) {
                    //   await newpage.close();
                    // }
                }
            } else {
                // trace_end 24시간 지나면 trace_end null값으로 변경
                console.log(
                    "trace_article 중단",
                    article_scraped[i].id,
                    article_scraped[i].href,
                    article_scraped[i].trace_end
                );
                const { updates, error } = await supabase
                    .from("article_scraped")
                    .update({ trace_end: null })
                    .match({ id: article_scraped[i].id });
            }
        }
    }
}

async function articleTypeCheck(SERVICENAME, browser, mainPage) {
    let type = [];
    let mainArticle_hrefs = [];
    //////////////////////////////////////////////////////////////////////////
    // 사이트마다 다르게
    if (SERVICENAME === "marketwatch") {
        type.push("main"); // main 이라는거 추가
        let mainArticle_left_hrefs = await mainPage.$$eval(
            "div.component.component--curated.curated--C > div.column.column--primary a",
            (linklist) =>
                linklist
                    .map((e) => e.getAttribute("href"))
                    .filter(
                        (e) => e.indexOf("https://www.marketwatch.com/investing") === -1
                    )
                    .filter(
                        (e) => e.indexOf("https://www.marketwatch.com/video") === -1
                    )
                    .filter((e) => e.lastIndexOf("_click_realtime") === -1)
                    .filter(
                        (e) => e.indexOf("https://www.marketwatch.com/visual-stories/") === -1
                    )
        );
        let mainArticle_right_hrefs = await mainPage.$$eval(
            "div.component.component--curated.curated--C > div.column.column--aside a",
            (linklist) =>
                linklist
                    .map((e) => e.getAttribute("href"))
                    .filter(
                        (e) => e.indexOf("https://www.marketwatch.com/investing") === -1
                    )
                    .filter(
                        (e) => e.indexOf("https://www.marketwatch.com/video") === -1
                    )
                    .filter((e) => e.lastIndexOf("_click_realtime") === -1)
                    .filter(
                        (e) => e.indexOf("https://www.marketwatch.com/visual-stories/") === -1
                    )
        );
        mainArticle_left_hrefs = _.uniq(mainArticle_left_hrefs);
        mainArticle_right_hrefs = _.uniq(mainArticle_right_hrefs);
        mainArticle_hrefs = _.concat(
            mainArticle_left_hrefs,
            mainArticle_right_hrefs
        );
        mainArticle_hrefs = _.uniq(mainArticle_hrefs);

        for (let i = 0; i < mainArticle_hrefs.length; i++) {
            mainArticle_hrefs[i] = mainArticle_hrefs[i].match(/(.*\?mod)/g, "");
        }

        mainArticle_hrefs = _.flattenDeep(mainArticle_hrefs);
    } else if (SERVICENAME === "barrons") {
        type.push("main"); // main 이라는거 추가
        let mainArticle_topleft_hrefs = await mainPage.$$eval(
            "div.style--column--2u7yywNS.style--column-top--2wtJOJkr.style--column-3--3ggXa4um.style--column--37Q00wRx.style--column-top--3XcIEFYc.style--column-3--2uQ31buJ.style--lead-collection-column--3IHqHQ1x.style--default-left--3wzJqPIY  a",
            (linklist) =>
                linklist
                    .map((e) => e.getAttribute("href"))
                    .filter(
                        (e) => e.substring(0, 33) === "https://www.barrons.com/articles/"
                    )
        );
        let mainArticle_topright_hrefs = await mainPage.$$eval(
            "div.style--column--2u7yywNS.style--column-top--2wtJOJkr.style--column-9--FhA9GyXF.style--column--37Q00wRx.style--column-top--3XcIEFYc.style--column-9--OhjllbiY a",
            (linklist) =>
                linklist
                    .map((e) => e.getAttribute("href"))
                    .filter(
                        (e) => e.substring(0, 33) === "https://www.barrons.com/articles/"
                    )
        );
        let mainArticle_middle_hrefs = await mainPage.$$eval(
            "div.style--grid--2cXhDDnR.BarronsTheme--grid--2JEpTORq > div:nth-child(2) > div.style--grid--2cXhDDnR.style--margin-bottom--24on0dr6.BarronsTheme--grid--2JEpTORq.BarronsTheme--margin-bottom--3Nwtw_nd.base--margin-bottom--3zAMr60S a",
            (linklist) =>
                linklist
                    .map((e) => e.getAttribute("href"))
                    .filter(
                        (e) => e.substring(0, 33) === "https://www.barrons.com/articles/"
                    )
        );
        let mainArticle_bottom_hrefs = await mainPage.$$eval(
            "div.style--grid--2cXhDDnR.BarronsTheme--grid--2JEpTORq > div.BarronsTheme--margin-bottom--hqA3d_i_.base--margin-bottom--3zAMr60S a",
            (linklist) =>
                linklist
                    .map((e) => e.getAttribute("href"))
                    .filter(
                        (e) => e.substring(0, 33) === "https://www.barrons.com/articles/"
                    )
        );

        mainArticle_hrefs = _.concat(
            mainArticle_topleft_hrefs,
            mainArticle_topright_hrefs,
            mainArticle_middle_hrefs,
            mainArticle_bottom_hrefs
        );
        mainArticle_hrefs = _.uniq(mainArticle_hrefs);

        //기사 url link가 다름
        // https://www.barrons.com/articles/roblox-stock-price-earnings-loss-51644961804?mod=RTA
        //https://www.barrons.com/articles/roblox-stock-price-earnings-loss-51644961804?mod=hp_LEAD_2
        for (let i = 0; i < mainArticle_hrefs.length; i++) {
            mainArticle_hrefs[i] = mainArticle_hrefs[i].match(/(.*\?mod)/g, "");
        }

        mainArticle_hrefs = _.flattenDeep(mainArticle_hrefs);
    } else if (SERVICENAME === "wsj") {
        type.push("main"); // main 이라는거 추가
        let mainArticle_top_hrefs = await mainPage.$$eval(
            "div#top-news  a",
            (linklist) => linklist.map((e) => e.getAttribute("href"))
        );
        let delete_comments_hrefs = await mainPage.$$eval(
            "span.WSJTheme--stats--2HBLhVc9 a",
            (linklist) => linklist.map((e) => e.getAttribute("href"))
        );
        mainArticle_hrefs = _.difference(
            mainArticle_top_hrefs,
            delete_comments_hrefs
        );
        mainArticle_hrefs = _.uniq(mainArticle_hrefs);

        // 기사별 url 맞춰주는 작업 필요
        // "****?mod" 로 맞추기위함

        for (let i = 0; i < mainArticle_hrefs.length; i++) {
            if (mainArticle_hrefs[i].match(/(.*\?mod)/g, "") === null) {
                mainArticle_hrefs[i] = mainArticle_hrefs[i] + "?mod";
            } else {
                mainArticle_hrefs[i] = mainArticle_hrefs[i].match(/(.*\?mod)/g, "");
            }
        }

        mainArticle_hrefs = _.flattenDeep(mainArticle_hrefs);
    } else if (SERVICENAME === "cnbc") {
        type.push("main"); // main 이라는거 추가
        let mainArticle_top_hrefs = await mainPage.$$eval(
            "div.RiverPlus-riverPlusContainer a",
            (linklist) =>
                linklist
                    .map((e) => e.getAttribute("href"))
                    .filter((e) => e !== "/pro/")
                    .filter((e) => e !== "/investingclub/")
                    .filter((e) => e.indexOf("https://www.cnbc.com/video/") === -1)
        );

        try {
            let breaking_hrefs = await mainPage.$$eval(
                "div.BreakingNews-container.BreakingNews-intro a",
                (linklist) =>
                    linklist
                        .map((e) => e.getAttribute("href"))
                        .filter((e) => e !== "/pro/")
                        .filter((e) => e !== "/investingclub/")
            );
            if (!_.isEmpty(breaking_hrefs)) {
                //속보처리
                type.push("main");
                type.push("breaking");
                console.log("breaking_hrefs", breaking_hrefs);
                console.log("type", type);
                await articleType_insert(
                    SERVICENAME,
                    mainPage,
                    browser,
                    breaking_hrefs,
                    type
                );
                type.pop("breaking");
            }
        } catch (e) { }
        let delete_comments_hrefs = await mainPage.$$eval(
            "div.RiverByline-bylineContainer a",
            (linklist) =>
                linklist
                    .map((e) => e.getAttribute("href"))
                    .filter((e) => e !== "/pro/")
                    .filter((e) => e !== "/investingclub/")
        );

        mainArticle_hrefs = _.difference(
            mainArticle_top_hrefs,
            delete_comments_hrefs
        );
        mainArticle_hrefs = _.uniq(mainArticle_hrefs);
    } else if (SERVICENAME === "nikkeiasia") {
        type.push("main"); // main 이라는거 추가
        let mainArticle_top_hrefs = await mainPage.$$eval(
            "section#topstories  a",
            (linklist) =>
                linklist
                    .map((e) => "https://asia.nikkei.com/" + e.getAttribute("href"))
                    .filter((e) => e.indexOf("https://asia.nikkei.com/https://") === -1)
                    .filter((e) => e.length >= 73)
        );

        mainArticle_hrefs = _.uniq(mainArticle_top_hrefs);

        _.pull(mainArticle_hrefs, "https://asia.nikkei.com/https://asia.nikkei.com/Spotlight/Market-Spotlight")
    } else if (SERVICENAME === "cnnbusiness") {
        type.push("main"); // main 이라는거 추가
        let mainArticle_left_hrefs = await mainPage.$$eval(
            "#us-zone-1 > div.l-container > div > div.column.zn__column--idx-0 > ul a",
            (linklist) =>
                linklist.map((e) => "https://www.cnn.com" + e.getAttribute("href"))
        );
        let mainArticle_right_hrefs = await mainPage.$$eval(
            "#us-zone-1 > div.l-container > div > div.column.zn__column--idx-1 > ul a",
            (linklist) =>
                linklist.map((e) => "https://www.cnn.com" + e.getAttribute("href"))
        );

        mainArticle_hrefs = _.concat(
            mainArticle_left_hrefs,
            mainArticle_right_hrefs
        );
        mainArticle_hrefs = _.uniq(mainArticle_hrefs);
    } else if (SERVICENAME === "foxbusiness") {
        type.push("main"); // main 이라는거 추가
        const fox_delete_hrefs = [
            "https://www.foxnews.com/media",
            "https://www.foxnews.com/entertainment",
            "https://www.foxnews.com/us",
        ];
        let mainArticle_left_hrefs = await mainPage.$$eval(
            "#wrapper > div > div.page-content > div > main a",
            (linklist) => linklist.map((e) => e.getAttribute("href"))
            //.filter((e) => e !== "https://www.foxbusiness.com/category/")
        );

        for (let i = 0; i < mainArticle_left_hrefs.length; i++) {
            if (
                mainArticle_left_hrefs[i].indexOf(
                    "https://www.foxbusiness.com/category/"
                ) === -1
            ) {
                mainArticle_hrefs.push(mainArticle_left_hrefs[i]);
            }
        }
        mainArticle_hrefs = _.uniq(mainArticle_hrefs);
        _.pullAll(mainArticle_hrefs, fox_delete_hrefs);
    } else if (SERVICENAME === "newyorktimes") {
        type.push("main"); // main 이라는거 추가

        let mainArticle_top_hrefs = await mainPage.$$eval(
            "#site-content > div > div.smartphone.css-1fig5gr > div > div:nth-child(2) a",
            (linklist) => linklist.map((e) => e.getAttribute("href"))
            //.filter((e) => e !== "https://www.foxbusiness.com/category/")
        );
        let mainArticle_bottom_hrefs = await mainPage.$$eval(
            "#site-content > div > div.smartphone.css-1fig5gr > div > div.css-1cobohp.e1ppw5w20 > div > div.css-18n1vmx.e17qa79g0 a",
            (linklist) => linklist.map((e) => e.getAttribute("href"))
            //.filter((e) => e !== "https://www.foxbusiness.com/category/")
        );

        mainArticle_hrefs = _.concat(
            mainArticle_top_hrefs,
            mainArticle_bottom_hrefs
        );
        let nyt_delete_hrefs = [];
        for (let i = 0; i < mainArticle_hrefs.length; i++) {
            if (mainArticle_hrefs[i].substring(23, 28) === "https") {
                nyt_delete_hrefs.push(article_hrefs[i]);
                continue;
            }
            if (
                mainArticle_hrefs[i].indexOf("https://www.nytimes.com/interactive") ===
                0
            ) {
                nyt_delete_hrefs.push(mainArticle_hrefs[i]);
                continue;
            }
            if (mainArticle_hrefs[i].indexOf("https://www.nytimes.com/video") === 0) {
                nyt_delete_hrefs.push(mainArticle_hrefs[i]);
                continue;
            }
            if (
                mainArticle_hrefs[i].indexOf("https://nytimes.com/interactive") === 0
            ) {
                nyt_delete_hrefs.push(mainArticle_hrefs[i]);
                continue;
            }
            if (
                mainArticle_hrefs[i].indexOf(
                    "https://www.nytimes.com/section/opinion"
                ) === 0
            ) {
                nyt_delete_hrefs.push(mainArticle_hrefs[i]);
                continue;
            }
        }
        _.pullAll(mainArticle_hrefs, nyt_delete_hrefs);
        mainArticle_hrefs = _.uniq(mainArticle_hrefs);
    } else if (SERVICENAME === "scmp") {
        type.push("main"); // main 이라는거 추가
        let first_hrefs = await mainPage.$$eval(
            "div.main-article-section__first-article.first-article a",
            (linklist) =>
                linklist
                    .map((e) => "https://www.scmp.com" + e.getAttribute("href"))
                    .filter((e) => new RegExp("&pgtype=homepage", "g").test(e) === true)
                    .filter((e) => e.indexOf("https://www.scmp.com/topics") === -1)
                    .filter((e) => e.indexOf("https://www.scmp.comhttps://") === -1)
        );
        let second_hrefs = await mainPage.$$eval(
            "div.main-article-section__section-articles.section-articles a",
            (linklist) =>
                linklist
                    .map((e) => "https://www.scmp.com" + e.getAttribute("href"))
                    .filter((e) => new RegExp("&pgtype=homepage", "g").test(e) === true)
                    .filter((e) => e.indexOf("https://www.scmp.com/topics") === -1)
                    .filter((e) => e.indexOf("https://www.scmp.comhttps://") === -1)
        );
        let third_hrefs = await mainPage.$$eval(
            "div.main-article-section__third-article.third-article > div.third-article__left-content a",
            (linklist) =>
                linklist
                    .map((e) => "https://www.scmp.com" + e.getAttribute("href"))
                    .filter((e) => new RegExp("&pgtype=homepage", "g").test(e) === true)
                    .filter((e) => e.indexOf("https://www.scmp.com/topics") === -1)
                    .filter((e) => e.indexOf("https://www.scmp.comhttps://") === -1)
        );

        mainArticle_hrefs = _.concat(first_hrefs, second_hrefs, third_hrefs);
        mainArticle_hrefs = _.uniq(mainArticle_hrefs);

        for (let i = 0; i < mainArticle_hrefs.length; i++) {
            if (mainArticle_hrefs[i].match(/(.*\?module)/g, "") === null) {
                mainArticle_hrefs[i] = mainArticle_hrefs[i];
            } else {
                mainArticle_hrefs[i] = mainArticle_hrefs[i].match(/(.*\?module)/g, "");
                // console.log("mainArticle", mainArticle_hrefs[i][0]);
                mainArticle_hrefs[i] = _.replace(
                    mainArticle_hrefs[i][0],
                    "?module",
                    ""
                );
            }
        }
        mainArticle_hrefs = _.flattenDeep(mainArticle_hrefs);
        //console.log(mainArticle_hrefs);
    } else if (SERVICENAME === "yahoofinance") {
        type.push("main"); // main 이라는거 추가
        let first_hrefs = await mainPage.$$eval(
            "div#Col1-0-ThreeAmigos-Proxy a",
            (linklist) => linklist.map((e) => e.getAttribute("href"))
        );

        let second_hrefs = await mainPage.$$eval(
            "div#slingstoneStream-0-Stream a",
            (linklist) =>
                linklist.map(
                    (e) => "https://finance.yahoo.com" + e.getAttribute("href")
                )
        );

        mainArticle_hrefs = _.concat(first_hrefs, second_hrefs);
        mainArticle_hrefs = _.uniq(mainArticle_hrefs);
    } else if (SERVICENAME === "afr") {
        type.push("main");
        let first_hrefs = await mainPage.$$eval("div._2X8-v a", (linklist) =>
            linklist
                .map((e) => "https://www.afr.com" + e.getAttribute("href"))
                .filter((e) => e.substring(0, 25) !== "https://www.afr.com/topic")
                .filter((e) => e !== "https://www.afr.com/rear-window")
        );
        let second_hrefs = await mainPage.$$eval(
            "div._18p-9._2KA9s a",
            (linklist) =>
                linklist
                    .map((e) => "https://www.afr.com" + e.getAttribute("href"))
                    .filter((e) => e.substring(0, 25) !== "https://www.afr.com/topic")
                    .filter((e) => e !== "https://www.afr.com/rear-window")
        );
        let third_hrefs = await mainPage.$$eval(
            "section._3MxkP._3z8XU a",
            (linklist) =>
                linklist
                    .map((e) => "https://www.afr.com" + e.getAttribute("href"))
                    .filter((e) => e.substring(0, 25) !== "https://www.afr.com/topic")
                    .filter((e) => e !== "https://www.afr.com/rear-window")
        );

        mainArticle_hrefs = _.concat(first_hrefs, second_hrefs, third_hrefs);
        mainArticle_hrefs = _.uniq(mainArticle_hrefs);
    } else if (SERVICENAME === "axios") {
        type.push("main");
        let first_hrefs = await mainPage.$$eval(
            "section[data-cy='top-stories-section'] a",
            (linklist) =>
                linklist
                    .map((e) => e.getAttribute("href"))
                    .filter((e) => e.length >= 45)
                    .filter((e) => e.indexOf("https://www.axios.com") !== -1)
                    .filter((e) => e.indexOf("https://www.axios.com/newsletters") === -1)
        );
        mainArticle_hrefs = _.uniq(first_hrefs);
    } else if (SERVICENAME === "caixinglobal") {
        type.push("main");
        let first_hrefs = await mainPage.$$eval(
            "div.top-stories-box.right-tit-common > div.con.cf a",
            (linklist) => linklist.map((e) => "https:" + e.getAttribute("href"))
        );
        mainArticle_hrefs = _.uniq(first_hrefs);
    } else if (SERVICENAME === "chinadaily") {
        type.push("main");
        let first_hrefs = await mainPage.$$eval("div.tMain a", (linklist) =>
            linklist
                .map((e) => "https:" + e.getAttribute("href"))
                .filter((e) => e.indexOf("https://www.chinadaily.com.cn/a/") !== -1)
        );

        mainArticle_hrefs = _.uniq(first_hrefs);
        console.log(mainArticle_hrefs);
    } else if (SERVICENAME === "globaltimescn") {
        type.push("main");
        let first_hrefs = await mainPage.$$eval(
            "#main_section01 > div a",
            (linklist) =>
                linklist
                    .map((e) => e.getAttribute("href"))
                    .filter((e) => e.indexOf("https://www.globaltimes.cn/page/") !== -1)
        );

        mainArticle_hrefs = _.uniq(first_hrefs);
    } else if (SERVICENAME === "xinhuanet") {
        type.push("main");
        let first_hrefs = await mainPage.$$eval(
            "body > div.area.main > div > div.headnews > div a",
            (linklist) =>
                linklist
                    .map((e) => e.getAttribute("href"))
                    .filter((e) => e !== null)
                    .filter((e) => e.indexOf("https://english.news.cn/20") !== -1)
        );

        mainArticle_hrefs = _.uniq(first_hrefs);
    } else if (SERVICENAME === "businessinsider") {
        type.push("main");
        let first_hrefs = await mainPage.$$eval(
            "section.river-item.featured-tout.homepage a",
            (linklist) =>
                linklist
                    .map((e) => e.getAttribute("href"))
                    .filter((e) => e.indexOf("https://www.businessinsider.com/") !== -1)
        );

        let second_hrefs = await mainPage.$$eval(
            "section.three-column-wrapper.popular-story-indicator a",
            (linklist) =>
                linklist
                    .map(
                        (e) => "https://www.businessinsider.com" + e.getAttribute("href")
                    )
                    .filter((e) => e.length > 55)
        );

        first_hrefs = _.uniq(first_hrefs);
        second_hrefs = _.uniq(second_hrefs);
        mainArticle_hrefs = _.concat(first_hrefs, second_hrefs);
    }

    ////////////////////////////////////////////////////////////////////////
    // 공용
    await articleType_insert(
        SERVICENAME,
        mainPage,
        browser,
        mainArticle_hrefs,
        type
    );
}

async function articleTypeCheck_dowjones(SERVICENAME, page, URL, type) {
    const { updates, error } = await supabase
        .from("article_scraped")
        .update({ type: type })
        .like("href", `%${URL}%`);
    //.match({ href: mainArticle_hrefs[index] });
}

async function articleType_insert(SERVICENAME, mainPage, browser, hrefs, type) {
    if (!_.isEmpty(hrefs)) {
        for (let index = 0; index < hrefs.length; index++) {
            // href 링크 있을경우에
            let { data: href, error } = await supabase
                .from("article_scraped")
                .select("href")
                .eq("site", SERVICENAME)
                .like("href", `%${hrefs[index]}%`);
            // .eq("href", mainArticle_hrefs[index])

            if (!_.isEmpty(href)) {
                // 기존 db에있다가 나중에 기사가 main으로 옮겨갔을때 사용
                // 기존 db에 type이 같을 경우 패스 구문
                let { data: db_type, type_error } = await supabase
                    .from("article_scraped")
                    .select("type")
                    .eq("site", SERVICENAME)
                    .like("href", `%${hrefs[index]}%`);

                db_type = db_type[0].type;
                typeCheck = _.difference(type, db_type);
                // 기존 db에 type 과 일치하는 value가 들어있을경우 pass 그렇지않으면 type update
                if (_.isEmpty(typeCheck)) {
                    continue;
                } else {
                    const { updates, error } = await supabase
                        .from("article_scraped")
                        .update({ type: type })
                        .like("href", `%${hrefs[index]}%`);
                    //.match({ href: mainArticle_hrefs[index] });
                    console.log("기존 href title type update 성공! ------", hrefs[index]);
                }
            } else {
                // db에 type을 넣어주는 part
                await downloadArticle(SERVICENAME, browser, hrefs[index]);
                await mainPage.waitForTimeout(1000);
                const { updates, error } = await supabase
                    .from("article_scraped")
                    .update({ type: type })
                    .like("href", `%${hrefs[index]}%`);
                //.match({ href: mainArticle_hrefs[index] });
                console.log("신규 href title type update 성공 -----", hrefs[index]);
            }
        }
    }
}


module.exports = {
    downloadArticle,
    deleteClass,
    loginCookies,
    traceArticle,
    articleTypeCheck,
    articleTypeCheck_dowjones,
    dowjonesDownloadArticle
};
