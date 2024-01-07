const parser = require("node-html-parser");
const utils = require("./utils");

const units = {
    bli: { unit: "blistr", factor: 1 },
    blistr: { unit: "blistr", factor: 1 },
    balení: { unit: "balení", factor: 1 },
    kus: { unit: "kus", factor: 1 },
    list: { unit: "listy", factor: 1 },
    sada: { unit: "sada", factor: 1 },
    pg: { unit: "balení", factor: 1 },
    unit: { unit: "balení", factor: 1 },
    pd: { unit: "p.dáv", factor: 1 },
};

exports.getCanonical = function (item, today) {
    item.priceHistory = [{ date: today, price: item.price }];
    return utils.convertUnit(item, units, "globus");
};

exports.fetchData = async function () {
    function roundNum(num, decimalExp = [1000, 100]) {
        if (num > 1) return Math.round(num * decimalExp[1]) / decimalExp[1];
        return Math.round(num * decimalExp[0]) / decimalExp[0];
    }

    let globusItems = [];
    const settings = {
        blockOfPages: 72,
        paginationClass: ".pagination__step-cz",
        itemContainter: "product-item",
        unitsClass: ".product-item__sale-volume",
        bio: "bio",
        bioMiddle: " bio ",
        scriptJSON: "script",
        rawMarks: ["catalog-right-side", "<toggler-click"],
        unitsBrackets: new RegExp(/(\S+)\s+(\S+)\/(\S+)\s+(\S+)/),
        units: new RegExp(/\((\S+)\s+(\S+)\/()(\S+)\)/),
        trim: new RegExp(/\s+/g),
        colonInApostrophes: new RegExp(/'([:,])'/g),
        bracketColon: new RegExp(/\{'/),
        colonBracket: new RegExp(/'\}/),
    };
    let page = 1,
        lastPage = -1;

    do {
        try {
            const res = await fetch(`https://shop.iglobus.cz/cs/search?sort=price_asc&ipp=${settings.blockOfPages}&page=${page}'#'`);
            let txt = await res.text();
            const fs = require("fs");
            if (fs.existsSync("stores/globus")) fs.writeFileSync(`stores/globus/GlobPage${page}.htm`, txt);
            //txt = fs.readFileSync(`stores/globus/GlobPage${page}.htm`).toString();
            let parseFrom = txt.indexOf(settings.rawMarks[0]) + settings.rawMarks[0].length;
            parseFrom = txt.indexOf(">", parseFrom) + 1;
            let parseTo = txt.indexOf(settings.rawMarks[1], parseFrom);
            parseTo = txt.lastIndexOf("</", parseTo);
            txt = txt.substring(parseFrom, parseTo);
            const root = parser.parse(txt);
            if (page == 1) {
                lastPage = root.querySelectorAll(settings.paginationClass);
                lastPage = lastPage
                    .pop()
                    .attributes.valueOf()
                    .href.match(/(\d+)#*$/)[1];
            }
            const items = root.getElementsByTagName(settings.itemContainter);
            console.log(`Globus pg ${page}/${lastPage} -> ${globusItems.length + items.length} items.`);
            for (var i of items) {
                let script = i.getElementsByTagName(settings.scriptJSON).pop().innerText;
                let [start, end] = [script.indexOf("{"), script.lastIndexOf("}")];
                let badComma = script.lastIndexOf(",", end);
                if (!script.substring(badComma + 1, end).trim().length) script = script.substring(start, badComma) + "}";
                else script = script.substring(start, end + 1);
                script = script
                    .replace(settings.trim, "")
                    .replace(settings.colonInApostrophes, '"$1"')
                    .replace(settings.bracketColon, '{"')
                    .replace(settings.colonBracket, '"}');
                let data = JSON.parse(script);
                data.id = data.sku;
                delete data.sku;
                let saleVolume = i.querySelector(settings.unitsClass).innerText.trim();
                data.price = parseFloat(data.price);
                saleVolume = saleVolume.match(settings.unitsBrackets) || saleVolume.match(settings.units);
                data.quantity = roundNum(data.price / saleVolume[1].replace(",", "."));
                data.unit = saleVolume[4];
                const name = data.name.toLocaleLowerCase();
                if ((name && name.startsWith(settings.bio)) || name.indexOf(settings.bioMiddle) > 0) {
                    data.bio = true;
                }
                delete data.position;
                delete data.list;
                globusItems.push(data);
            }
        } catch (e) {
            console.error(e.message);
        }
    } while (page++ < lastPage);
    return globusItems;
};

exports.initializeCategoryMapping = async () => {};

exports.mapCategory = (rawItem) => {};
