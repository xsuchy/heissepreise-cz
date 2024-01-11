const parser = require("node-html-parser");
const utils = require("./utils");
const puppeteer = require("puppeteer");

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
    const settings = {
        blockOfPages: 48,
        bio: "bio",
        bioMiddle: " bio ",
    };
    let browser = await puppeteer.launch();
    let pageObj = (await browser.pages())[0];
    await pageObj.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36");

    let tescoItems = [];

    let categories;
    const fs = require("fs");
    const debugEnv = fs.existsSync("stores/tesco");
    if (debugEnv) {
        categories = fs.readFileSync("stores/tesco/taxonomy.json").toString();
    } else {
        await pageObj.goto("https://nakup.itesco.cz/groceries/cs-CZ/taxonomy", { waitUntil: "networkidle2" });
        categories = await pageObj.waitForSelector("body");
        categories = await categories.getProperty("innerText");
        categories = await categories.jsonValue();
        fs.writeFileSync("stores/tesco/taxonomy.json", categories);
    }
    categories = JSON.parse(categories);
    const baseUrl = "https://nakup.itesco.cz/groceries/cs-CZ/shop";

    for (let i = 0; i < categories.length; i++) {
        let main = categories[i];
        const cat = main.name;
        let childUrl = main.children[0].url;
        let page = 1,
            pagination,
            txt;
        const parserOpts = {
            lowerCaseTagName: true, // convert tag name to lower case (hurts performance heavily)
            comment: false, // retrieve comments (hurts performance slightly)
            blockTextElements: {
                script: true,
                noscript: false,
                style: true,
                pre: false,
            },
        };

        do {
            // https://nakup.itesco.cz/groceries/cs-CZ/shop/ovoce-a-zelenina/all (?page=1...)
            const Url = `${baseUrl}${childUrl}?page=${page}&count=${settings.blockOfPages}`;
            console.log(`Tesco ${tescoItems.length} - ${i + 1}. z ${categories.length} ${Url}`);

            try {
                console.log(`Tesco ${Url}`);
                const file = `stores/tesco/${main.catId}_${(page + 100).toString().substr(1)}.htm`;
                if (debugEnv && fs.existsSync(file)) {
                    await pageObj.goto(`file://${process.cwd().replace(/\\/g, "/")}/${file}`);
                } else {
                    do {
                        try {
                            await pageObj.setUserAgent(
                                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36"
                            );
                            await pageObj.goto(Url, { waitUntil: "networkidle2" });
                            break;
                        } catch (e) {
                            let randomWait = (parseInt(Math.random() * 16) + 1) * 1000;
                            console.error(`${e.message}\n${e.stack}\nWaiting ${randomWait / 1000}s before repeat.`);
                            await browser.close();
                            const browser2 = await puppeteer.launch();
                            pageObj = (await browser2.pages())[0];
                            browser = browser2;
                            await new Promise((resolve) => setTimeout(resolve, randomWait));
                        }
                    } while (1);
                    txt = await pageObj.waitForSelector("html");
                    txt = await txt.getProperty("outerHTML");
                    txt = await txt.jsonValue();
                    fs.writeFileSync(`stores/tesco/${main.catId}_${(page + 100).toString().substr(1)}.htm`, txt);
                }
                txt = await pageObj.waitForSelector("div.items-count__filter-caption > div.pagination__items-displayed");
                pagination = await txt.getProperty("innerText");
                pagination = await pagination.jsonValue();
                pagination = pagination.match(/(\d+)\s+[\S]+\s+(\d+)\s+[\S]+\s+(\d+)/).slice(1, 4);
                console.log(`Tesco ${pagination.join(" ")}.`);

                let items = await pageObj.waitForSelector("ul.product-list.grid");
                items = await items.getProperty("innerHTML");
                items = await items.jsonValue();
                items = parser.parse(items, parserOpts);

                let item = items.firstChild;

                do {
                    let paragraphs = item.querySelectorAll("p");
                    if (item.querySelectorAll("p").length == 0) {
                        item = item.nextElementSibling;
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
                    item = item.nextElementSibling;
                } while (item);
            } catch (e) {
                console.log(`Tesco items ${e}`);
            }
            page++;
        } while (pagination[1] != pagination[2]);
    }

    return tescoItems;
};

exports.initializeCategoryMapping = async () => {};

exports.mapCategory = (rawItem, item) => {
    if (item.category) return item.category;
    return null;
};
