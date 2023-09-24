const axios = require("axios");
const utils = require("./utils");
const { categories, toCategoryCode, fromCategoryCode, getCategory } = require("../site/model/categories");
const HITS = Math.floor(30000 + Math.random() * 2000);

const units = {
    kus: { unit: "ks", factor: 1 },
    kilogram: { unit: "kg", factor: 1 },
};

exports.getCanonical = function (item, today) {
    let quantity = 1;

    return utils.convertUnit(
        {
            id: item.productId,
            name: item.name,
            description: item.descriptionShort ?? "",
            price: item.price.regular.value / 100,
            priceHistory: [{ date: today, price: item.price.regular.value / 100 }],
            isWeighted: item.weightArticle,
            unit: item.packageLabelKey,
            quantity,
            bio: item.badges && item.badges.includes("pp-bio"),
        },
        units,
        "billa"
    );
};

exports.fetchData = async function () {
    const items = [];
    const lookup = {};
    let numDuplicates = 0;

    for (let i = 1; i <= categories.length; i++) {
        const category = categories[i - 1];

        let page = 0;
        let pageSize = 100;
        let itemsInPage = 100;
        while (itemsInPage === pageSize) {
            const BILLA_SEARCH = `https://shop.billa.cz/api/categories/${category.name}/products?page=${page}&pageSize=${pageSize}`;
            const data = (await axios.get(BILLA_SEARCH)).data;
            itemsInPage = parseInt(data.count);
            data.results.forEach((item) => {
                try {
                    const canonicalItem = exports.getCanonical(item);
                    if (lookup[canonicalItem.id]) {
                        numDuplicates++;
                        return;
                    }
                    lookup[canonicalItem.id] = item;
                    items.push(item);
                } catch (e) {
                    // Ignore super tiles
                    console.log(`Failed to process ${item.name} because of ${e}`);
                }
            });
            page++;
        }
    }
    console.log(`Duplicate items in BILLA data: ${numDuplicates}, total items: ${items.length}`);
    return items;
};

exports.initializeCategoryMapping = async () => {
    // FIXME check if categories have changed.
};

exports.mapCategory = (rawItem) => {};

exports.urlBase = "https://shop.billa.at";
