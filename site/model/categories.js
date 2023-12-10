// These are a match of the Billa categories
exports.categories = [
    {
        name: "pecivo-1198",
    },
    {
        name: "grilovani-2094",
    },
    {
        name: "zpatky-do-skoly-2211",
    },
    {
        name: "ovoce-a-zelenina-1165",
    },
    {
        name: "chlazene-mlecne-a-rostlinne-vyrobky-1207",
    },
    {
        name: "maso-a-ryby-1263",
    },
    {
        name: "uzeniny-lahudky-a-hotova-jidla-1276",
    },
    {
        name: "mrazene-1307",
    },
    {
        name: "trvanlive-potraviny-1332",
    },
    {
        name: "cukrovinky-1449",
    },
    {
        name: "napoje-1474",
    },
    {
        name: "specialni-a-rostlinna-vyziva-1576",
    },
    {
        name: "pece-o-dite-1582",
    },
    {
        name: "drogerie-a-domacnost-1901",
    },
    {
        name: "mazlicci-1630",
    },
    {
        name: "billa-regionalne-1667",
    },
];

exports.categories.forEach((category, index) => (category.index = index));

exports.toCategoryCode = (i, j) => {
    return (
        (i < 10 ? "" + i : String.fromCharCode("A".charCodeAt(0) + (i - 10))) + (j < 10 ? "" + j : String.fromCharCode("A".charCodeAt(0) + (j - 10)))
    );
};

exports.fromCategoryCode = (code) => {
    if (!code || code.length != 2) return [exports.categories.length - 1, 0];
    const codeI = code.charCodeAt(0);
    const codeJ = code.charCodeAt(1);
    return [
        codeI - (codeI < "A".charCodeAt(0) ? "0".charCodeAt(0) : "A".charCodeAt(0) - 10),
        codeJ - (codeJ < "A".charCodeAt(0) ? "0".charCodeAt(0) : "A".charCodeAt(0) - 10),
    ];
};

exports.isValidCode = (code) => {
    const [i, j] = exports.fromCategoryCode(code);
    if (i < 0 || i >= exports.categories.length) return false;
    const category = exports.categories[i];
    if (j < 0 || j >= exports.categories.subcategories) return false;
    return true;
};

exports.getCategory = (code) => {
    const [i, j] = exports.fromCategoryCode(code);
    return [exports.categories[i], exports.categories[i].subcategories[j]];
};

exports.UNKNOWN_CATEGORY = exports.toCategoryCode(exports.categories.length - 1, 0);

if (require.main === module) {
    const code = exports.toCategoryCode(10, 1);
    console.log(code);
    const [i, j] = exports.fromCategoryCode("A1");
    console.log(i + ", " + j);
    console.log(exports.isValidCode("F1"));
    console.log(exports.isValidCode("11"));
    console.log(exports.getCategory("A1"));
}
