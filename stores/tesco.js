const parser = require("node-html-parser");
const utils = require("./utils");

const units = {
    kus: { unit: "kus", factor: 1 },
};

exports.getCanonical = function (item, today) {
    return utils.convertUnit(
        {
            id: "" + item.id,
            name: item.name,
            // description: "", not available
            price: item.price,
            priceHistory: [{ date: today, price: item.price }],
            unit: item.unit,
            quantity: item.quantity,
            categoryNames: item.category,
            ...(item.name && /( bio )|(^bio )/i.test(item.name) && { bio: true }),
        },
        units,
        "tesco"
    );
};

function roundNum(num, decimalExp = [1000, 100]) {
    if (num > 1) return Math.round(num * decimalExp[1]) / decimalExp[1];
    return Math.round(num * decimalExp[0]) / decimalExp[0];
}
function readPrice(txt) {
    let real = txt
        .match(/([ 0-9,.]+) \S+$/)[1]
        .replace(/,/, ".")
        .replace(/ /, "");
    let num = parseFloat(real);
    if (isNaN(num)) {
        console.log(`Tesco ${num} invalid.`);
        return real;
    }
    return num;
}
exports.fetchData = async function () {
    let headers = { cookie: [] };
    async function firstGet(fetchOpts, Url) {
        let res = undefined;
        await fetch(Url, fetchOpts).then((response) => {
            res = response;
            for (const pair of response.headers) {
                console.log(`all0 ${pair[0]}:${pair[1]}`);
                if (pair[0] == "content-length") continue;
                if (pair[0] == "set-cookie") {
                    headers.cookie.push(pair[1].split(";")[0]);
                } else {
                    headers[pair[0]] = pair[1];
                }
            }
        });
        fetchOpts.headers.cookie = headers.cookie.join("; ");
        headers.cookie = [];
        txt = await res.text();
        let magics = parser.parse(txt.substring(txt.indexOf("<html")), parserOpts);
        let scripts = magics.getElementsByTagName("script");
        let body = scripts
            .pop()
            .innerText.match(/(\{"bm-verify":.+:\s+)j\}\)/)
            .pop();
        let mth = scripts.pop().innerText.match(/(\d+)/g);
        let j = Number(mth[0]) + Number(mth[1] + mth[2]);
        body += j + "}";
        fetchOpts.headers["content-type"] = "application/json";
        fetchOpts.headers["sec-fetch-dest"] = "empty";
        fetchOpts.headers["sec-fetch-mode"] = "cors";
        delete fetchOpts.headers["sec-fetch-user"];
        fetchOpts.headers.Referer = Url;
        fetchOpts.body = body;
        fetchOpts.method = "POST";
        res = await fetch("https://nakup.itesco.cz/_sec/verify?provider=interstitial", fetchOpts).then((response) => {
            for (const pair of response.headers) {
                console.log(`provider ${pair[0]}:${pair[1]}`);
                if (pair[0] == "content-length") continue;
                if (pair[0] == "set-cookie") {
                    headers.cookie.push(pair[1].split(";")[0]);
                } else {
                    headers[pair[0]] = pair[1];
                }
            }
        });
        delete fetchOpts.body;

        return headers.cookie.join("; ");
    }
    let parserOpts = {
        lowerCaseTagName: true, // convert tag name to lower case (hurts performance heavily)
        comment: false, // retrieve comments (hurts performance slightly)
        blockTextElements: {
            script: true,
            noscript: false,
            style: true,
            pre: false,
        },
    };
    let tescoItems = [];

    const catRaw = await fetch("https://nakup.itesco.cz/groceries/cs-CZ/taxonomy");
    let txt = await catRaw.text();
    const categories = JSON.parse(txt);
    const baseUrl = "https://nakup.itesco.cz/groceries/cs-CZ/shop";
    let fetchOpts = {
        headers: {
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "accept-language": "cs,en;q=0.9,en-GB;q=0.8,en-US;q=0.7",
            "cache-control": "no-cache",
            pragma: "no-cache",
            "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-origin",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1",
            referrerPolicy: "strict-origin-when-cross-origin",
        },
        body: null,
    };

    for (let i = 0; i < categories.length; i++) {
        let main = categories[i];
        const cat = main.name;
        let childUrl = main.children[0].url;
        let page = 1,
            pagination;

        do {
            // https://nakup.itesco.cz/groceries/cs-CZ/shop/ovoce-a-zelenina/all (?page=1...)
            const Url = `${baseUrl}${childUrl}?page=${page}&count=48`;
            console.log(`${tescoItems.length} - ${i + 1}. z ${categories.length} ${Url}`);
            if (!tescoItems.length) {
                await firstGet(fetchOpts, Url);
                fetchOpts.headers.cookie = headers.cookie.join("; ");
                fetchOpts.method = "GET";
            }

            headers.cookie = [];
            await fetch(Url, fetchOpts).then((response) => {
                res = response;
                for (const pair of response.headers) {
                    if (pair[0] == "content-length") continue;
                    if (pair[0] == "set-cookie") {
                        headers.cookie.push(pair[1].split(";")[0]);
                    } else {
                        headers[pair[0]] = pair[1];
                    }
                }
            });
            // fetchOpts.headers.cookie = headers.cookie.join('; ');
            txt = await res.text();
            let root = parser.parse(txt.substring(txt.indexOf("<html")), parserOpts);

            let items = root.querySelectorAll("div > div > div > div > div > div:last-of-type > ul > li");

            for (let item of items) {
                pagination = root.querySelector("div#main > div > div > div > div > div > div > div > div > div > div").firstChild.innerText;
                if (item == items[0]) console.log(`${pagination}.`);
                pagination = pagination.match(/(\d+)\s+[\S]+\s+(\d+)\s+[\S]+\s+(\d+)/).slice(1, 4);
                let paragraphs = item.querySelectorAll("p");
                if (item.querySelectorAll("p").length == 0) {
                    continue; // Tento produkt je momentálně nedostupný
                }
                let unitInfo = paragraphs.pop();
                let unitPrice = readPrice(unitInfo.innerText);
                let price = readPrice(paragraphs.pop().innerText);
                let itemData = {
                    store: "tesco",
                    id: item.querySelector("form > input[name=id]").getAttribute("value"),
                    name: item.querySelector("img").getAttribute("alt"),
                    description: undefined,
                    price: price,
                    priceHistory: [],
                    unit: unitInfo.innerText.match(/\/(\S+)$/)[1],
                    quantity: roundNum(price / unitPrice),
                    category: cat,
                };
                tescoItems.push(itemData);
            }
            page++;
        } while (pagination[1] != pagination[2]);
    }

    return tescoItems;
};

exports.initializeCategoryMapping = async () => {};

exports.mapCategory = (rawItem, item) => {
    if (item.categoryNames) return item.categoryNames;
    return null;
};
