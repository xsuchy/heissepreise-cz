const allSpacesRegex = / /g;

exports.stores = {
    billa: {
        name: "Billa",
        budgetBrands: ["clever"],
        color: "yellow",
        defaultChecked: true,
        getUrl: (item) => `https://shop.billa.at/produkte/${item.id}`,
    },
    lidl: {
        name: "Lidl",
        budgetBrands: ["milbona", "alpengut", "cien", "livarno", "wiesentaler"],
        color: "pink",
        defaultChecked: true,
        getUrl: (item) => `https://www.lidl.at${item.url}`,
        removeOld: true,
    },
};

exports.STORE_KEYS = Object.keys(exports.stores);
exports.BUDGET_BRANDS = [...new Set([].concat(...Object.values(exports.stores).map((store) => store.budgetBrands)))];
