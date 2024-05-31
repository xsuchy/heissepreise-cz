const axios = require("axios");
const utils = require("./utils");

const HITS = Math.floor(30000 + Math.random() * 2000);

const units = {
    "": { unit: "kus", factor: 1 },
    dosen: { unit: "kus", factor: 1 },
    flasche: { unit: "kus", factor: 1 },
    flaschen: { unit: "kus", factor: 1 },
    "pkg.": { unit: "kus", factor: 1 },
    pce: { unit: "kus", factor: 1 },
    balení: { unit: "kus", factor: 1 },
    lg: { unit: "kg", factor: 1 },
    prací: { unit: "PD", factor: 1 },
    "g=": { unit: "g", factor: 1 }, // 100 g= 26,47 Kč/PP (Zelené olivy)
};

exports.getCanonical = function (item, today) {
    if (
        // 0 IN_STORE
        item.stockAvailability.availabilityIndicator == 1 || // SOLDOUT_ONLINE
        item.stockAvailability.availabilityIndicator == 2 // SOON_ONLINE
    )
        // 3 AVAILABLE_ONLINE
        return null;
    let from = item.stockAvailability.badgeInfo?.badges?.filter((b) => b.type.endsWith("_IN_STORE_AS_OF"));
    let monthDay = today.slice(-5);
    let translatedDate = from?.pop()?.text.replace(/Od (\d{2})\.(\d{2})\. .+/, "$2-$1");
    if (translatedDate > monthDay) return null; // { text: "Od 21.09. pouze v prodejnách", type: "ONLY_IN_STORE_AS_OF" }
    let quantity = 1;
    let unit = item.price?.packaging?.unit ?? "";
    let text = (item.price.basePrice?.text ?? "").trim().split("(")[0].replaceAll(",", ".").toLowerCase();
    let isWeighted = false;

    if (text === "cena za 1 kg") {
        isWeighted = true;
        unit = "kg";
    } else {
        if (text.startsWith("bei") && text.search("je ") != -1) text = text.substr(text.search("je "));

        if (text.length) for (let s of ["ab ", "je ", "ca. ", "z.b.: ", "z.b. "]) text = text.replace(s, "").trim();

        const regex = /^([0-9.x ]+)(.*)$/;
        const matches = text.match(regex);
        if (matches) {
            matches[1].split("x").forEach((q) => {
                quantity = quantity * parseFloat(q.split("/")[0]);
            });
            unit = matches[2].split("/")[0].trim().split(" ")[0];
        }
        unit = unit.split("-")[0];
    }

    const name = item.fullTitle ?? item?.keyfacts?.fullTitle;

    return utils.convertUnit(
        {
            id: item.productId,
            name,
            description: item.keyfacts?.description ?? "",
            price: item.price.price,
            priceHistory: [{ date: today, price: item.price.price }],
            unit,
            quantity,
            url: item.canonicalUrl,
            bio: name.toLowerCase().includes("bio"),
        },
        units,
        "lidl"
    );
};

exports.fetchData = async function () {
    const LIDL_SEARCH = `https://www.lidl.cz/p/api/gridboxes/CZ/cs/?max=${HITS}`;
    let data = await axios.get(LIDL_SEARCH);
    /* AVAILABLE_ONLINE = 3,  IN_STORE = 0, SOLDOUT_ONLINE = 1, SOON_ONLINE = 2 */
    return data.data.filter(
        (item) => !!item.price.price && (item.stockAvailability.availabilityIndicator == 0 || item.stockAvailability.availabilityIndicator == 3)
    );
};

exports.initializeCategoryMapping = async () => {};

exports.mapCategory = (rawItem) => {};

exports.urlBase = "https://www.lidl.cz";
