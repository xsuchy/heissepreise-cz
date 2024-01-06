const allSpacesRegex = / /g;

exports.stores = {
    billa: {
        name: "Billa",
        budgetBrands: ["clever"],
        color: "yellow",
        defaultChecked: true,
        getUrl: (item) => (item.url ? `https://shop.billa.cz/produkt/${item.url}` : `https://www.google.com/search?q="${item.id}"`),
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
    albert: {
        name: "Albert",
        budgetBrands: [],
        color: "green",
        defaultChecked: true,
        getUrl: (item) => `https://www.albert.cz${item.url}`,
    },
    globus: {
        name: "Globus",
        budgetBrands: [],
        color: "rose",
        defaultChecked: true,
        getUrl: (item) => `https://shop.iglobus.cz${item.url}`,
    },
    tesco: {
        name: "Tesco",
        budgetBrands: [],
        color: "emerald",
        defaultChecked: true,
        getUrl: (item) => `https://nakup.itesco.cz/groceries/cs-CZ/products/${item.id}`,
    },
    kaufland: {
        name: "Kaufland",
        budgetBrands: [],
        color: "blue",
        defaultChecked: true,
        getUrl: (item) => `https://www.kosik.cz${item.url}`,
    },
};

exports.STORE_KEYS = Object.keys(exports.stores);
exports.BUDGET_BRANDS = [...new Set([].concat(...Object.values(exports.stores).map((store) => store.budgetBrands)))];
