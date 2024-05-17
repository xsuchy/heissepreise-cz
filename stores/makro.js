const parser = require("node-html-parser");
const utils = require("./utils");
const stores = require("../site/model/stores");

const units = {
    párů: { unit: "kus", factor: 1 },
};

exports.getCanonical = function (item, today) {
    item.priceHistory = [{ date: today, price: item.price }];
    delete item.category;
    return utils.convertUnit(item, units, "macro");
};

exports.fetchData = async function () {
    const baseUrl = stores.stores.makro.getUrl({ url: "" });
    const parseOpts = {
        lowerCaseTagName: true, // convert tag name to lower case (hurts performance heavily)
        comment: false, // retrieve comments (hurts performance slightly)
        blockTextElements: {
            script: true,
            noscript: false,
            style: true,
            pre: false,
        },
    };
    let macroItems = [];

    const catRaw = await fetch("https://sortiment.makro.cz/cs/");
    let txt = await catRaw.text();
    let catLinks = parser.parse(txt.substring(txt.indexOf("<html")), parseOpts);
    catLinks = catLinks.querySelectorAll(".action-item a.menu-item.has-children");
    let categories = [];
    for (let o of catLinks) {
        categories.push([o.getAttribute("href"), o.text]);
    }

    for (let main of categories) {
        let page = 1;
        let pages = -1;

        do {
            // https://sortiment.makro.cz/cs/cerstve-chlazene/7068c/?inactionforce=1?p=1&&view_price=s
            const Url = `${main[0]}?p=${page}&view_price=s`; // &view_mode=bal
            if (page == 1) console.log(`${main[1]} ${Url}`);
            else console.log(Url);

            const catRaw = await fetch(Url);
            let txt = await catRaw.text();
            let pageDOM = parser.parse(txt.substring(txt.indexOf("<html")), parseOpts);
            if (pages < 0) {
                pages = pageDOM.querySelector(".mo-pagination.pagination");
                if (pages === null) pages = 0;
                else pages = pages.querySelectorAll("a").length;
            }
            let items = pageDOM.querySelectorAll(".product-layer-content");

            for (let item of items) {
                let url = item.querySelector(".product-title a");
                let id = url
                    .getAttribute("href")
                    .match(/\/([^\/]+)\/$/)
                    .pop(); // .../112726p/
                let name = url.text;
                let units = name.match(/([\d,]+)(?!.*\d)/).index;
                if (name.endsWith("PET")) {
                    let si = name.substr(units + name.match(/([\d,]+)(?!.*\d)/)[0].length);
                    units = name.substr(units).match(/([\d,]+)(?!.*\d)/);
                    si = si.match(/\s*([^\sx\d)]+)/);
                    units = [units.pop(), si.pop()];
                } else {
                    units = name.substr(units);
                    units = units.match(/([\d,]+)\s{0,1}([^\sx\d)]+)/i).slice(-2);
                }
                let price = item.querySelector(".product-price-value.product-price-value-primary");
                if (price === null) continue;
                price = price.text.replace(/\s+([\d,]+)[\S\s]+/, "$1");
                let itemData = {
                    store: "makro",
                    id: id,
                    name: name,
                    price: parseFloat(price.replace(",", ".")),
                    priceHistory: [],
                    unit: units[1].toLowerCase(),
                    quantity: parseFloat(units[0].replace(",", ".")),
                    url: url.getAttribute("href").replace(baseUrl, ""),
                    categoryNames: main[1],
                };
                if (itemData.name.indexOf("BIO") > 0) {
                    itemData.bio = true;
                }
                macroItems.push(itemData);
            }
        } while (page++ < pages);
    }

    return macroItems;
};

exports.initializeCategoryMapping = async () => {};

exports.mapCategory = () => {
    return null;
};
