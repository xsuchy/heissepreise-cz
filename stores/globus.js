const axios = require("axios");
const utils = require("./utils");

const units = {
    bli: { unit: "blistr", factor: 1 }, // 1x
    list: { unit: "sada", factor: 1 }, // 5x
    pg: { unit: "balení", factor: 1 },
};

exports.getCanonical = function (item, today) {
    return utils.convertUnit(
        {
            id: "" + item.ean[0],
            name: item.name,
            description: item.description,
            price: item.productInHouse.actualPrice,
            priceHistory: [{ date: today, price: item.productInHouse.actualPrice }],
            unit: item.unitId,
            quantity: item.baseVariantQuantity,
            url: `${item.name
                .toLowerCase()
                .replace(/\s+/g, "-")
                .match(/[a-z0-9-]+/gi)
                .join("")}/${item.ean[0]}`,
            // https://shop.iglobus.cz/cz/mango-zral-balen-rte-2-ks/8594023949733 .../kokosov-oech-1-ks/107200
            categoryNames: item.productInHouse.placements?.category || item.productCategories[0],
            ...(item.name && /^Bio[ -]/.test(item.name) && { bio: true }),
        },
        units,
        "globus"
    );
};

exports.fetchData = async function () {
    const categories = {
        1: "Čerstvé potraviny",
        2: "Trvanlivé potraviny",
        4: "Pečivo",
        5: "Maso, uzeniny",
        10: "Ostatní",
        12: "Dům, zahrada",
        14: "Alkoholické nápoje",
        15: "Nealkoholické nápoje",
        16: "Lahůdky",
        17: "Mražené",
        18: "Drogerie",
        19: "Domácnost",
        20: "Zábava a volný čas",
        21: "Elektro",
        22: "Móda",
        23: "Vlastní výroba",
        24: "Zdravý svět",
    };

    let globusItems = [];
    const blockOfPages = 16;

    // Brno,Praha-Černý Most,Praha-Zličín,Pardubice,Praha-Čakovice,Liberec,Ostrava,Olomouc,České Budějovice,Chomutov,Plzeň-Chotíkov,Opava,Karlovy Vary-Jenišov,Trmice,Havířov,Praha-Štěrboholy
    const shops = [
        4001, //4002, 4003, 4004, 4005, /*!23>*/4006, 4007, 4008, 4009, 4010, 4011, 4012, 4014/*<!23*/, 4015, /*!23>*/4019, 4026
    ];
    for (let shop of shops) {
        const GLOBUS_BASE_URL = `https://www.globus.cz/api/v1/gsoa/actionOffers/houses/${shop}/actionProductsCatalog?filter=categoryId:in `;
        for (let category in categories) {
            let page = 0,
                remains = 0,
                res;
            do {
                const query = `${category}&listedProductOnly=false&blickPunkt=false&page=${page}&pageSize=${blockOfPages}`;
                try {
                    res = await axios.get(GLOBUS_BASE_URL + query, {
                        validateStatus: function (status) {
                            return (status >= 200 && status < 300) || status == 429;
                        },
                    });
                } catch (e) {
                    console.log(e);
                    break;
                }
                remains = res.data.paginationShowMore;

                // exponential backoff
                backoff = 2000;
                while (res.status != 200) {
                    console.info(`Globus API returned ${res.status}, retrying in ${backoff / 1000}s.`);
                    await new Promise((resolve) => setTimeout(resolve, backoff));
                    backoff *= 2;
                    try {
                        res = await axios.get(GLOBUS_BASE_URL + query, {
                            validateStatus: function (status) {
                                return (status >= 200 && status < 300) || status == 429;
                            },
                        });
                    } catch (e) {
                        console.log(e);
                        break;
                    }
                }
                if (!res.data.products.length && !page) break;
                globusItems = globusItems.concat(res.data.products);
                console.log(`Globus ${categories[category]}/${page} ${res.data.products.length}/${remains} (${globusItems.length})`);
                page++;
                await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 10));
            } while (remains);
        }
    }

    return globusItems;
};

exports.initializeCategoryMapping = async () => {};

exports.mapCategory = (rawItem, item) => {
    if (item?.categoryNames?.length !== undefined) return item.categoryNames[0];
    return null;
};

//exports.urlBase = "https://shop.iglobus.cz/cz/";
