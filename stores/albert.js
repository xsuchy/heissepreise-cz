const axios = require("axios");
const utils = require("./utils");

const units = {
    piece: { unit: "kus", factor: 1 }, // 13820x
    kg: { unit: "kilogram", factor: 1 }, // 302x
};

function readPrice(txt) {
    let real = txt
        .match(/([ 0-9,.]+) \S+$/)[1]
        .replace(/,/, ".")
        .replace(/ /, "");
    let num = parseFloat(real);
    if (isNaN(num)) {
        console.log(`Albert ${txt} invalid.`);
        return real;
    }
    return num;
}
function roundNum(num, decimalExp = [1000, 100]) {
    num = num.constructor === Number ? num : parseFloat(num.replace(",", "."));
    if (num > 1) return Math.round(num * decimalExp[1]) / decimalExp[1];
    return Math.round(num * decimalExp[0]) / decimalExp[0];
}

exports.getCanonical = function (item, today) {
    let quantity;
    if (item.price.supplementaryPriceLabel2 && item.price.supplementaryPriceLabel2.indexOf(" ") > 0) {
        quantity = item.price.supplementaryPriceLabel2.split(" "); // 0,5 l / 250 g / 6x 1,5 l ...
        if (quantity.length > 2) quantity = quantity.slice(quantity.length - 2);
    } else {
        quantity = [item.productProposedPackaging, item.price.unit];
    }
    let bio = item.badges;
    for (let x of bio) {
        if (x.code == "badgeattributebio") {
            bio = true;
            break;
        }
    }
    const discountedPrice = readPrice(item.price.discountedPriceFormatted); // .replace(/\s+[^\d^\s]+$/,"")
    return utils.convertUnit(
        {
            id: "" + item.code,
            name: item.name,
            // description: "", not available
            price: discountedPrice,
            priceHistory: [{ date: today, price: discountedPrice }],
            unit: quantity[1],
            quantity: roundNum(quantity[0]),
            url: item.url,
            categoryNames: item.categoryNames,
            category: item.category,
            ...(bio === true && { bio: true }),
        },
        units,
        "albert"
    );
};

async function sha256(message) {
    // encode as UTF-8
    const msgBuffer = new TextEncoder().encode(message);

    // hash the message
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);

    // convert ArrayBuffer to Array
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    // convert bytes to hex string
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hashHex;
}

exports.fetchData = async function () {
    const body = { query: "query DeviceId {deviceId}" };
    let axiosConfiguration = {
        headers: {
            "Content-Type": "application/json;charset=UTF-8",
            "X-Apollo-Operation-Name": "DeviceId",
        },
    };

    const deviceId = await axios
        .post("https://www.albert.cz/api/v1/", body, axiosConfiguration)
        .then((res) => {
            return res.data.data.deviceId;
        })
        .catch((err) => {
            console.log("error: ", err);
        });

    let albertItems = [];
    if (!deviceId) return albertItems;

    let sha256Hash = await sha256(
        "query LeftHandNavigationBar($rootCategoryCode: String, $cutOffLevel: String, $lang: String, $topLevelCategoriesToHideIfEmpty: String, $anonymousCartCookie: String) {\n  leftHandNavigationBar(\n    rootCategoryCode: $rootCategoryCode\n    cutOffLevel: $cutOffLevel\n    lang: $lang\n    topLevelCategoriesToHideIfEmpty: $topLevelCategoriesToHideIfEmpty\n    anonymousCartCookie: $anonymousCartCookie\n  ) {\n    categoryTreeList {\n      categoriesInfo {\n        categoryCode\n        levelInfo {\n          ...CategoryFields\n          __typename\n        }\n        __typename\n      }\n      level\n      __typename\n    }\n    levelInfo {\n      ...CategoryFields\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment CategoryFields on CategoryLevelInfo {\n  name\n  productCount\n  url\n  code\n  __typename\n}"
    ); // sha256Hash = '29a05b50daa7ab7686d28bf2340457e2a31e1a9e4d79db611fcee435536ee01c';

    const ALBERT_BASE_URL = "https://www.albert.cz/api/v1/?operationName=";
    const CATEGORY_CODES =
        'LeftHandNavigationBar&variables={"rootCategoryCode":"","cutOffLevel":"4","lang":"cs"}&extensions={"persistedQuery":{"version":1,"sha256Hash":"' +
        sha256Hash +
        '"}}';

    let categories = await fetch(ALBERT_BASE_URL + CATEGORY_CODES, axiosConfiguration);
    if (categories.status == 200) {
        categories = await categories.json();
    } else return albertItems;
    if (!categories || !categories?.data?.leftHandNavigationBar?.levelInfo?.length) return albertItems;

    const blockOfPages = 40; // original 20 / max. 50
    sha256Hash = await sha256(
        "query GetProductSearch($lang: String, $searchQuery: String, $pageSize: Int, $pageNumber: Int, $category: String, $sort: String, $filterFlag: Boolean, $useSpellingSuggestion: Boolean, $customerSegment: String, $facetsOnly: Boolean, $includeSponsoredProducts: Boolean!, $keyword: String!) {\n  productSearch: productSearchV2(\n    lang: $lang\n    searchQuery: $searchQuery\n    pageSize: $pageSize\n    pageNumber: $pageNumber\n    category: $category\n    sort: $sort\n    filterFlag: $filterFlag\n    useSpellingSuggestion: $useSpellingSuggestion\n    customerSegment: $customerSegment\n    facetsOnly: $facetsOnly\n  ) {\n    products {\n      ...ProductBlockDetails\n      __typename\n    }\n    breadcrumbs {\n      ...Breadcrumbs\n      __typename\n    }\n    facets {\n      ...Facets\n      __typename\n    }\n    sorts {\n      name\n      selected\n      code\n      __typename\n    }\n    pagination {\n      ...Pagination\n      __typename\n    }\n    freeTextSearch\n    spellingSuggestionUsed\n    currentQuery {\n      query {\n        value\n        __typename\n      }\n      __typename\n    }\n    productsCountByCategory {\n      categoryCode\n      count\n      __typename\n    }\n    __typename\n  }\n  sponsoredProducts: sponsoredProducts(keyword: $keyword, lang: $lang) @include(if: $includeSponsoredProducts) {\n    products {\n      ...ProductBlockDetails\n      __typename\n    }\n    auctionId\n    __typename\n  }\n}\n\nfragment ProductBlockDetails on Product {\n  available\n  averageRating\n  numberOfReviews\n  manufacturerName\n  manufacturerSubBrandName\n  code\n  badges {\n    ...ProductBadge\n    __typename\n  }\n  badgeBrand {\n    ...ProductBadge\n    __typename\n  }\n  promoBadges {\n    ...ProductBadge\n    __typename\n  }\n  delivered\n  littleLion\n  freshnessDuration\n  freshnessDurationTipFormatted\n  frozen\n  recyclable\n  images {\n    format\n    imageType\n    url\n    __typename\n  }\n  isBundle\n  isProductWithOnlineExclusivePromo\n  maxOrderQuantity\n  limitedAssortment\n  mobileFees {\n    ...MobileFee\n    __typename\n  }\n  name\n  newProduct\n  onlineExclusive\n  potentialPromotions {\n    isMassFlashOffer\n    endDate\n    alternativePromotionMessage\n    alternativePromotionBadge\n    code\n    priceToBurn\n    promotionType\n    pickAndMix\n    qualifyingCount\n    freeCount\n    range\n    redemptionLevel\n    toDisplay\n    description\n    title\n    promoBooster\n    simplePromotionMessage\n    offerType\n    restrictionType\n    priority\n    percentageDiscount\n    __typename\n  }\n  price {\n    approximatePriceSymbol\n    currencySymbol\n    formattedValue\n    priceType\n    supplementaryPriceLabel1\n    supplementaryPriceLabel2\n    showStrikethroughPrice\n    discountedPriceFormatted\n    discountedUnitPriceFormatted\n    unit\n    unitPriceFormatted\n    unitCode\n    unitPrice\n    value\n    __typename\n  }\n  purchasable\n  productPackagingQuantity\n  productProposedPackaging\n  productProposedPackaging2\n  stock {\n    inStock\n    inStockBeforeMaxAdvanceOrderingDate\n    partiallyInStock\n    availableFromDate\n    __typename\n  }\n  url\n  previouslyBought\n  nutriScoreLetter\n  isLowPriceGuarantee\n  isHouseholdBasket\n  isPermanentPriceReduction\n  freeGift\n  plasticFee\n  __typename\n}\n\nfragment ProductBadge on ProductBadge {\n  code\n  image {\n    ...Image\n    __typename\n  }\n  tooltipMessage\n  name\n  __typename\n}\n\nfragment Image on Image {\n  altText\n  format\n  galleryIndex\n  imageType\n  url\n  __typename\n}\n\nfragment MobileFee on MobileFee {\n  feeName\n  feeValue\n  __typename\n}\n\nfragment Breadcrumbs on SearchBreadcrumb {\n  facetCode\n  facetName\n  facetValueName\n  facetValueCode\n  removeQuery {\n    query {\n      value\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment Facets on Facet {\n  code\n  name\n  category\n  facetUiType\n  values {\n    code\n    count\n    name\n    query {\n      query {\n        value\n        __typename\n      }\n      __typename\n    }\n    selected\n    __typename\n  }\n  __typename\n}\n\nfragment Pagination on Pagination {\n  currentPage\n  totalResults\n  totalPages\n  sort\n  __typename\n}"
    ); // 25af9abab4c15ca0eb1a366c762f7bc07222142aa86f417f98ee312922a90c75

    const useSpellingSuggestion = false;
    for (let levels of categories.data.leftHandNavigationBar.levelInfo) {
        let levelStarts = 1;
        let page = 0,
            remains = 0;
        do {
            const query = `GetProductSearch&variables={"lang":"cs","searchQuery":"","category":"${levels.code}","pageNumber":${page},"pageSize":${blockOfPages},"filterFlag":true,"plainChildCategories":true,"useSpellingSuggestion":${useSpellingSuggestion},"includeSponsoredProducts":false,"keyword":"chips"}&extensions={"persistedQuery":{"version":1,"sha256Hash":"${sha256Hash}"}}`;
            const res = await axios.get(ALBERT_BASE_URL + query, {
                validateStatus: function (status) {
                    return (status >= 200 && status < 300) || status == 429;
                },
            });
            if (levelStarts) {
                remains = res.data.data.productSearch.pagination.totalResults;
                console.log(
                    `Albert ${levels.name}(${levels.code}) ${res.data.data.productSearch.pagination.totalPages}x${blockOfPages} => ${albertItems.length} + ${remains}`
                );
                levelStarts = 0;
            }

            // exponential backoff
            backoff = 2000;
            while (res.status != 200) {
                console.info(`Albert API returned ${res.status}, retrying in ${backoff / 1000}s.`);
                await new Promise((resolve) => setTimeout(resolve, backoff));
                backoff *= 2;
                res = await axios.get(ALBERT_BASE_URL + query, {
                    validateStatus: function (status) {
                        return (status >= 200 && status < 300) || status == 429;
                    },
                });
            }
            let items = res.data.data.productSearch.products;
            for (let i = 0; i < items.length; i++) {
                for (let key in items[i]) {
                    if (items[i][key] === null) delete items[i][key];
                }
                items[i].categoryNames = levels.name;
                items[i].category = levels.code;
            }
            albertItems = albertItems.concat(items);
            remains -= items.length;
            page++;
            await new Promise((resolve) => setTimeout(resolve, 100));
        } while (remains);
    }

    return albertItems;
};

exports.initializeCategoryMapping = async () => {};

exports.mapCategory = (rawItem) => {
    return rawItem.category ?? rawItem.categoryNames;
};

exports.urlBase = "https://www.albert.cz/";
