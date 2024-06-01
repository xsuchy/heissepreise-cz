const axios = require("axios");
const utils = require("./utils");
const HTMLParser = require("node-html-parser");
const MAXITEMS = 10000;

const units = {
    bd: { unit: "kus", factor: 1 },
    gr: { unit: "g", factor: 1 },
    lt: { unit: "ml", factor: 1000 },
    pk: { unit: "kus", factor: 1 },
    pa: { unit: "kus", factor: 1 },
    rl: { unit: "kus", factor: 1 },
    tb: { unit: "kus", factor: 1 },
};

exports.getCanonical = function (item, today) {
    let quantity = item.amount;
    let unit = item.volumeLabelKey;
    if (!item.price) return null;
    let price = (item.price.loyalty?.value ?? item.price.regular.value) / 100;
    let priceHistory = [];
    if (((item.price?.validityStart > today) ||
    (item.price?.validityEnd < today)) && item.price?.crossed) {
        if (item.price?.validityStart)
            priceHistory = [{ date: item.price?.validityStart, price: price }];
        price = Math.max(price, item.price?.crossed / 100);
    }
    return utils.convertUnit(
        {
            id: item.productId,
            name: item.name,
            // description: "", not available
            price: price,
            priceHistory: priceHistory.concat({ date: today, price: price }),
            isWeighted: item.isWeightArticle,
            unit,
            quantity,
            bio: item.name.toLowerCase().includes("bio") && !item.name.toLowerCase().includes("fabio"),
            url: item.sku.replace("-", ""),
        },
        units,
        "penny"
    );
};

exports.fetchData = async function (local) {
    hits = 100;
    page = 0;
    done = false;
    result = [];
    while (!done) {
        const PENNY_SEARCH = `https://www.penny.cz/api/products?page=${page}&pageSize=${hits}`;
        data = (await axios.get(PENNY_SEARCH)).data;
        done = data.count < hits || page * hits > MAXITEMS;
        page++;
        result = result.concat(data.results);
    }
    return result;
};
async function saveLocal()
{
    const fs = require("fs");
    let data = await exports.fetchData(1); 
    const tdy = (new Date()).toISOString().substr(0,10);
    for(let i=0;i<data.length;i++)
    {
        data[i] = exports.getCanonical(data[i], tdy);
    }
    fs.writeFileSync("penny.json", JSON.stringify(data,0,2));
    debugger;
}
if (require.main === module) {
    saveLocal();
}

async function parseCategory(url, parent, result, lookup) {
    const data = (await axios.get(url)).data;
    const dom = HTMLParser.parse(data);
    const categoryTitle = dom.querySelector('[data-test="category-title"]')?.textContent;
    if (url != "https://www.penny.cz/category" && categoryTitle.includes("VŠECHNY KATEGORIE")) return;
    const categories = dom.querySelectorAll('[data-test="category-tree-navigation-button"]');
    for (const category of categories) {
        const link = "https://www.penny.cz" + category.getAttribute("href");
        const name = (parent ? parent + " -> " : "") + category.lastChild.previousElementSibling.innerText.trim().replace("&amp;", "&");
        if (name.startsWith("VŠECHNY AKCE")) continue;

        if (!lookup.has(link)) {
            lookup.add(link);
            result.push({
                id: name,
                url: link,
                code: null,
            });

            try {
                await parseCategory(link, name, result, lookup);
            } catch (e) {
                // Ignore, sometimes the server responds with 502. No idea why
            }
        }
    }
}

exports.initializeCategoryMapping = async () => {
    const categories = [];
    await parseCategory("https://www.penny.cz/category", null, categories, new Set());
    utils.mergeAndSaveCategories("penny", categories);

    exports.categoryLookup = {};
    for (const category of categories) {
        exports.categoryLookup[category.id] = category;
    }
};

exports.mapCategory = (rawItem) => {
    const categoryPath = rawItem.parentCategories.filter((path) => path.length > 0 && !path[0].name.includes("ngebot"))[0];
    if (!categoryPath) return null;
    const categoryName = categoryPath.map((path) => path.name).join(" -> ");
    const category = exports.categoryLookup[categoryName];
    if (category) return category.code;
    return null;
};

exports.urlBase = "https://www.penny.cz/products/";

if (require.main == module) {
    (async () => {
        await exports.initializeCategoryMapping();
    })();
}
