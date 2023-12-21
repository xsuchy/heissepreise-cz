const axios = require("axios");
const utils = require("./utils");

const units = {
    ks: { unit: "útržků", factor: 1 }, // 3815x
    ml: { unit: "mililitr", factor: 1 }, // 5711x
    mm: { unit: "mililitr", factor: 1 }, // 5x
    g: { unit: "gram", factor: 1 }, // 3355x
    porci: { unit: "gram", factor: 1 }, // 2x
    kg: { unit: "kilogram", factor: 1 }, // x54
    m: { unit: "metr", factor: 1 }, // 20x
    l: { unit: "litr", factor: 1 }, // 106x
    "útrž.": { unit: "útržků", factor: 1 }, // 21x
    pd: { unit: "prací dávka", factor: 1 }, // 197x
    md: { unit: "mycí dávka", factor: 1 } // 7x
};

exports.getCanonical = function (item, today) {
    let quantity = item.netQuantityContent || item.basePriceQuantity;
    let unit = item.contentUnit || item.basePriceUnit;
    return utils.convertUnit(
        {
            id: "" + item.gtin,
            name: `${item.brandName} ${item.title}`,
            // description: "", not available
            price: item.price.value,
            priceHistory: [{ date: today, price: item.price.value }],
            unit,
            quantity,
            url: item.relativeProductUrl,
            ...((item.brandName === "dmBio" || (item.name && /^Bio[ -]/.test(item.name))) && { bio: true }),
        },
        units,
        "dm"
    );
};

exports.fetchData = async function () {
    const DM_BASE_URL = `https://product-search.services.dmtech.com/cz/search/crawl?pageSize=1000&`;
    const QUERIES = [
        "allCategories.id=010000&price.value.to=50", //~325 items
        "allCategories.id=010000&price.value.from=50&price.value.to=80", //~547 items
        "allCategories.id=010000&price.value.from=80&price.value.to=100", //~387 items
        "allCategories.id=010000&price.value.from=100&price.value.to=150", //~395 items
        "allCategories.id=010000&price.value.from=150&price.value.to=200", //~342 items
        "allCategories.id=010000&price.value.from=200&price.value.to=250", //~410 items
        "allCategories.id=010000&price.value.from=250", //~726 items
        "allCategories.id=020000&price.value.to=50", //~490 items
        "allCategories.id=020000&price.value.from=50&price.value.to=80", //~578 items
        "allCategories.id=020000&price.value.from=80&price.value.to=100", //~487 items
        "allCategories.id=020000&price.value.from=100&price.value.to=150", //~690 items
        "allCategories.id=020000&price.value.from=150&price.value.to=200", //~558 items
        "allCategories.id=020000&price.value.from=200&price.value.to=250", //~244 items
        "allCategories.id=020000&price.value.from=250&price.value.to=300", //~275 items
        "allCategories.id=020000&price.value.from=300", //~812 items       
        "allCategories.id=030000&price.value.to=50", //~131 items
        "allCategories.id=030000&price.value.from=50&price.value.to=150", //~567 items
        "allCategories.id=030000&price.value.from=90", //~578 items
        "allCategories.id=040000&price.value.to=50", //~615 items
        "allCategories.id=040000&price.value.from=50&price.value.to=80", //~345 items
        "allCategories.id=040000&price.value.from=80", //~231 items
        "allCategories.id=050000&price.value.to=120", //~865 items
        "allCategories.id=050000&price.value.from=120", //~840 items
        "allCategories.id=060000&price.value.to=100", //~871 items
        "allCategories.id=060000&price.value.from=100", //~685 items
        "allCategories.id=070000", //~305 items
    ];

    let dmItems = [];
    for (let query of QUERIES) {
        var res = await axios.get(DM_BASE_URL + query, {
            validateStatus: function (status) {
                return (status >= 200 && status < 300) || status == 429;
            },
        });

        // exponential backoff
        backoff = 2000;
        while (res.status == 429) {
            console.info(`DM API returned 429, retrying in ${backoff / 1000}s.`);
            await new Promise((resolve) => setTimeout(resolve, backoff));
            backoff *= 2;
            res = await axios.get(DM_BASE_URL + query, {
                validateStatus: function (status) {
                    return (status >= 200 && status < 300) || status == 429;
                },
            });
        }
        let items = res.data;
        if (items.count > items.products.length) {
            console.warn(
                `DM Query matches ${items.count} items, but API only returns first ${items.products.length}. Adjust queries. Query: ${query}`
            );
        }
        dmItems = dmItems.concat(items.products);
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return dmItems;
};

exports.initializeCategoryMapping = async () => {};

exports.mapCategory = (rawItem) => {};

exports.urlBase = "https://www.dm.cz/product-p";
