// These are a match of the Billa categories, which are organized in a 2-level hierarchy.
// Each category in the top level gets a code from 1-Z, each sub category also gets a code.
// Together the two codes from a unique id for the category, which we store in the item.category
// field. E.g. "Obst & Gemüse > Salate" has the code "13", "Kühlwaren > Tofu" has the code "4C"
exports.categories = [
    {
        name: "pecivo-1198",
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
