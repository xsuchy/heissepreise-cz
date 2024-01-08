const parser = require("node-html-parser");
const utils = require("./utils");

const units = {
    kus: { unit: "kus", factor: 1 },
};

exports.getCanonical = function (item, today) {
    item.priceHistory = [{ date: today, price: item.price }];
    return utils.convertUnit(item, units, "tesco");
};

function roundNum(num, decimalExp = [1000, 100]) {
    if (num > 1) return Math.round(num * decimalExp[1]) / decimalExp[1];
    return Math.round(num * decimalExp[0]) / decimalExp[0];
}
exports.fetchData = async function () {
    const settings = {
        blockOfPages: 48,
        bio: "bio",
        bioMiddle: " bio ",
        scriptJSON: "script",
        rawMarks: ["data-redux-state"],
    };
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
        let magics = parser.parse(txt.substring(txt.indexOf("<html")), {
            lowerCaseTagName: true, // convert tag name to lower case (hurts performance heavily)
            comment: false, // retrieve comments (hurts performance slightly)
            blockTextElements: {
                script: true,
                noscript: false,
                style: true,
                pre: false,
            },
        });
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

        const fs = require("fs");
        const debugEnv = fs.existsSync("stores/tesco");

        do {
            // https://nakup.itesco.cz/groceries/cs-CZ/shop/ovoce-a-zelenina/all (?page=1...)
            const Url = `${baseUrl}${childUrl}?page=${page}&count=${settings.blockOfPages}`;
            console.log(`${tescoItems.length} - ${i + 1}. z ${categories.length} ${Url}`);
            if (!tescoItems.length && !debugEnv) {
                await firstGet(fetchOpts, Url);
                fetchOpts.headers.cookie = headers.cookie.join("; ");
                fetchOpts.method = "GET";
            }

            headers.cookie = [];
            if (debugEnv) txt = fs.readFileSync(`stores/tesco/${main.catId}_${(page + 100).toString().substr(1)}.htm`).toString();
            else {
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
                txt = await res.text();
                if (debugEnv) fs.writeFileSync(`stores/tesco/${main.catId}_${(page + 100).toString().substr(1)}.htm`, txt);
            }

            let parseFrom = txt.indexOf(settings.rawMarks[0]) + settings.rawMarks[0].length; // <body ... data-redux-state="{&quot;
            parseFrom = txt.indexOf("=", parseFrom) + 1; // ="{&quot;
            parseFrom = txt.indexOf('"', parseFrom) + 1; // &quot;accountPage
            let parseTo = txt.indexOf('"', parseFrom); // hasLastOrder&quot;:false}}" ...
            pagination = JSON.parse(txt.substring(parseFrom, parseTo).replace(/&quot;/g, '"')).results;
            let items = pagination.pages[page - 1].serializedData;

            for (let item of items) {
                if (item == items[0]) console.log(`${pagination.pageNo}/${pagination.pages.length} of ${pagination.totalCount}.`);
                let itemData = item[1].product;
                itemData = {
                    store: "tesco",
                    id: itemData.id,
                    name: itemData.title,
                    description: item[1].promotions[0]?.offerText || itemData.title,
                    price: itemData.price,
                    priceHistory: [],
                    unit: itemData.unitOfMeasure,
                    quantity: roundNum(itemData.price / itemData.unitPrice),
                    categoryNames: itemData.departmentName,
                };
                if (itemData.name.startsWith(settings.bio) || itemData.name.indexOf(settings.bioMiddle) > 0) {
                    itemData.bio = true;
                }
                tescoItems.push(itemData);
            }
        } while (pagination.pages.length != page++);
    }

    return tescoItems;
};

exports.initializeCategoryMapping = async () => {};

exports.mapCategory = (rawItem, item) => {
    if (item.categoryNames) return item.categoryNames;
    return null;
};
