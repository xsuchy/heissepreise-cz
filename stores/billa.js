const axios = require("axios");
const fs = require("fs");
const utils = require("./utils");

const units = {
    kus: { unit: "ks", factor: 1 },
    kilogram: { unit: "kg", factor: 1 },
};

const baseCategorySlugs = [
    "ovoce-a-zelenina-1165",
    "pecivo-1198",
    "chlazene-mlecne-a-rostlinne-vyrobky-1207",
    "maso-a-ryby-1263",
    "uzeniny-lahudky-a-hotova-jidla-1276",
    "mrazene-1307",
    "trvanlive-potraviny-1332",
    "cukrovinky-1449",
    "napoje-1474",
    "specialni-a-rostlinna-vyziva-1576",
    "pece-o-dite-1582",
    "drogerie-a-domacnost-1901",
    "mazlicci-1630",
    "billa-regionalne-1667",
];

// Map from old categories (see categories.js) to new categories in new Billa Store
const subCategoryMap = {
    "vegan-13911": "3A",
    "tofu-14529": "3A",
    "fleisch-und-gefluegel-13921": "42",
    "fisch-und-meeresfruechte-13930": "43",
    "pizza-baguette-und-gebaeck-13936": "46",
    "pommes-frites-und-mehr-13935": "45",
    "tiefkuehlgerichte-13922": "42",
    "gemuese-kraeuter-und-obst-13934": "44",
    "eis-13917": "40",
    "suessspeisen-und-torten-13939": "47",
    "vegane-ernaehrung-14048": "5D",
    "filter-und-entkalker-14535": "83",
    "hygiene-schutzartikel-14536": "8F",
};

exports.getCanonical = function (item, today) {
    let price = item.price?.loyalty ?? item.price.regular;
    if (item.weightPerPiece != 0) price = price.perStandardizedQuantity / 100;
    else price = price.value / 100;
    return utils.convertUnit(
        {
            id: item.sku,
            name: item.name,
            description: item.descriptionShort ?? "",
            price,
            priceHistory: [{ date: today, price }],
            isWeighted: item.weightArticle,
            unit: item.volumeLabelShort ?? item.price.baseUnitShort,
            quantity: parseFloat(item.amount),
            bio: item.badges && item.badges.includes("pp-bio") ? true : false,
            url: item.slug,
        },
        units,
        "billa"
    );
};

exports.generateCategories = async function () {
    const categories = [];
    let baseIndex = 0;
    for (const baseSlug of baseCategorySlugs) {
        const data = await axios.get(`https://shop.billa.cz/api/categories/${baseSlug}/child-properties`);
        data.data.forEach((value, index) => {
            const code = subCategoryMap[value.slug] ?? baseIndex.toString(16).toUpperCase() + index.toString(16).toUpperCase();
            categories.push({
                id: value.slug,
                description: value.name,
                url: "https://shop.billa.cz/produkty/" + value.slug,
                code,
            });
        });
        baseIndex++;
    }
    return categories;
};

exports.fetchData = async function () {
    const categories = await exports.generateCategories();
    const rawItems = [];
    for (const category of categories) {
        let page = 0;
        while (true) {
            const data = await axios.get(`https://shop.billa.cz/api/categories/${category.id}/products?pageSize=500&page=${page}`);
            page++;
            if (data.data.count == 0) break;
            for (const rawItem of data.data.results) {
                rawItem.mappedCategory = category.code;
            }
            rawItems.push(...data.data.results);
        }
        // console.log("Fetched Billa category " + category.id);
    }
    const lookup = {};
    const dedupRawItems = [];
    let duplicates = 0;
    for (const rawItem of rawItems) {
        if (lookup[rawItem.sku]) {
            duplicates++;
        } else {
            lookup[rawItem.sku] = rawItem;
            dedupRawItems.push(rawItem);
        }
    }
    // console.log("Billa duplicates: " + duplicates);
    // console.log("Billa total items: " + dedupRawItems.length);
    return dedupRawItems;
};

exports.initializeCategoryMapping = async () => {
    // FIXME check if categories have changed.
};

exports.mapCategory = (rawItem) => {
    return rawItem.mappedCategory;
};

exports.urlBase = "https://shop.billa.cz";

if (require.main === module) {
    main();
}

/* Test code, ensuring the data from the old Billa store is still compatible with the data from the new Billa store.
 you can get an old latest-canonical.json from here:
 https://marioslab.io/uploads/latest-canonical-2023-10-22.json
*/
function currentDate() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const day = String(currentDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

async function main() {
    const categories = await exports.generateCategories();
    console.log(categories);
    const oldCanonical = fs.existsSync("old-canonical.json")
        ? JSON.parse(fs.readFileSync("old-canonical.json"))
        : (await axios.get("https://heisse-preise.io/data/latest-canonical.json")).data;
    fs.writeFileSync("old-canonical.json", JSON.stringify(oldCanonical, null, 2));
    const oldItems = oldCanonical.filter((item) => item.store == "billa");
    const oldItemsLookup = {};
    for (const oldItem of oldItems) {
        oldItemsLookup[oldItem.id] = oldItem;
    }
    const newItems = fs.existsSync("billa-new.json") ? JSON.parse(fs.readFileSync("billa-new.json")) : await exports.fetchData();
    fs.writeFileSync("billa-new.json", JSON.stringify(newItems, null, 2));
    const canonicalItems = [];
    for (const newItem of newItems) {
        const canonicalItem = exports.getCanonical(newItem, currentDate());
        canonicalItems.push(canonicalItem);
        const oldItem = oldItemsLookup[newItem.sku];
        if (!oldItem) continue;

        let change = false;

        if (Math.abs(canonicalItem.price - oldItem.price) / oldItem.price > 1) {
            console.log(
                "Too big a price difference " +
                    canonicalItem.id +
                    " " +
                    canonicalItem.name +
                    ", old: " +
                    oldItem.price +
                    ", new: " +
                    canonicalItem.price
            );
            change = true;
        }
        if (canonicalItem.isWeighted != oldItem.isWeighted) {
            console.log(
                "!= isWeighted " + canonicalItem.id + " " + canonicalItem.name + ", old: " + oldItem.isWeighted + ", new: " + canonicalItem.isWeighted
            );
            change = true;
        }
        if (canonicalItem.unit != oldItem.unit) {
            console.log("!= unit " + canonicalItem.id + " " + canonicalItem.name + ", old: " + oldItem.unit + ", new: " + canonicalItem.unit);
            change = true;
        }
        if (canonicalItem.quantity != oldItem.quantity) {
            console.log(
                "!= quantity " + canonicalItem.id + " " + canonicalItem.name + ", old: " + oldItem.quantity + ", new: " + canonicalItem.quantity
            );
            change = true;
        }
        if (canonicalItem.bio != oldItem.bio) {
            console.log("!= bio " + canonicalItem.id + " " + canonicalItem.name + ", old: " + oldItem.bio + ", new: " + canonicalItem.bio);
            change = true;
        }
        if (canonicalItem.category != oldItem.category) {
            console.log(
                "!= category " + canonicalItem.id + " " + canonicalItem.name + ", old: " + oldItem.category + ", new: " + canonicalItem.category
            );
            change = true;
        }
        if (change) console.log("\n");
    }

    console.log("Canonical items");
}
