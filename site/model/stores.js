const allSpacesRegex = / /g;

exports.stores = {
    billa: {
        name: "Billa",
        budgetBrands: ["clever"],
        color: "yellow",
        defaultChecked: true,
        getUrl: (item) => `https://shop.billa.cz/produkt/${item.url}`,
    },
    lidl: {
        name: "Lidl",
        budgetBrands: ["milbona", "alpengut", "cien", "livarno", "wiesentaler", "pilos", "náš kraj", "crivit", "parkside", "silvercrest", "esmara"],
        color: "pink",
        defaultChecked: true,
        getUrl: (item) => `https://www.lidl.cz${item.url}`,
        removeOld: true,
    },
    penny: {
        name: "Penny",
        budgetBrands: [
            "louisa a bodie",
            "na gril",
            "boni",
            "kouzelný čaj",
            "penny",
            "karlova koruna",
            "tanja",
            "řezníkův talíř",
            "staročech",
            "od českých farmářů",
            "wippy",
            "mrazivá čerstvost",
            "enjoy",
            "solty",
            "crip crop",
        ],
        color: "purple",
        defaultChecked: true,
        getUrl: (item) => `https://www.penny.cz/products/${item.url}`,
        removeOld: true,
    },
    dm: {
        name: "DM",
        budgetBrands: ["balea"],
        color: "orange",
        defaultChecked: true,
        getUrl: (item) => `https://www.dm.cz/product-p${item.url}`,
    },
    tesco: {
        name: "Tesco",
        budgetBrands: [],
        color: undefined,
        defaultChecked: true,
        getUrl: (item) => `https://nakup.itesco.cz/groceries/cs-CZ/products/${item.id}`,
    },
};

exports.STORE_KEYS = Object.keys(exports.stores);
exports.BUDGET_BRANDS = [...new Set([].concat(...Object.values(exports.stores).map((store) => store.budgetBrands)))];
