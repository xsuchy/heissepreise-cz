const parser = require("node-html-parser");
const utils = require("./utils");
const { json } = require("express");

const units = {
    bli: { unit: "blistr", factor: 1 },
    blistr: { unit: "blistr", factor: 1 },
    balení: { unit: "balení", factor: 1 },
    kus: { unit: "kus", factor: 1 },
    list: { unit: "listy", factor: 1 },
    sada: { unit: "sada", factor: 1 },
    pg: { unit: "balení", factor: 1 },
    unit: { unit: "balení", factor: 1 },
};

exports.getCanonical = function (item, today) {
    const price = parseFloat(item.price);

    let canItem = utils.convertUnit(
        {
            id: item.sku,
            name: item.name,
            description: undefined,
            price: price,
            priceHistory: [{ date: today, price: price }],
            unit: item.saleVolume[4],
            quantity: price / item.saleVolume[1].replace(",", "."),
            url: item.url,
            categoryNames: undefined,
            ...(item.name && /( bio )|(^bio )/i.test(item.name) && { bio: true }),
        },
        units,
        "globus"
    );
    canItem.quantity = canItem.quantity + 0.001 > 1 ? Math.round(canItem.quantity) : Math.round(canItem.quantity * 1000) / 1000;

    return canItem;
};

exports.fetchData = async function () {
    let globusItems = [];
    const blockOfPages = 72;
    let page = 1,
        lastPage = -1;

    do {
        try {
            // const res = await fetch(`https://shop.iglobus.cz/cs/search?sort=price_asc&ipp=${blockOfPages}&page=${page}'#'`);
            // const txt = await res.text();
            // const fs = require('fs'); if (fs.existsSync('stores/globus')) fs.writeFileSync(`stores/globus/GlobPage${page}.htm`, txt);
            const fs = require("fs");
            const txt = fs.readFileSync(`stores/globus/GlobPage${page}.htm`).toString();
            const root = await parser.parse(txt.substring(txt.indexOf("<html")));
            if (page == 1) {
                lastPage = await root.querySelectorAll(".pagination__step-cz");
                lastPage = lastPage
                    .pop()
                    .attributes.valueOf()
                    .href.match(/(\d+)#*$/)[1];
            }
            const items = root.getElementsByTagName("product-item");
            console.log(`Globus pg ${page}/${lastPage} -> ${globusItems.length + items.length} items.`);
            for (var i of items) {
                let script = i.getElementsByTagName("script").pop().innerText;
                const [start, end] = [script.indexOf("{"), script.lastIndexOf("}")];
                script = script
                    .substring(start, end + 1)
                    .replace(/\s+/g, "")
                    .replace(/,\}$/, "}")
                    .replace(/'([:,])'/g, '"$1"')
                    .replace(/\{'/, '{"')
                    .replace(/'\}/, '"}');
                const data = JSON.parse(script);
                i.querySelector(".product-item__sale-volume")
                    .innerText.trim()
                    .match(/\((\S+)\s+(\S+)\/()(\S+)\)|(\S+)\s+(\S+)\/(\S+)\s+(\S+)/);
                const saleVolume = i.querySelector(".product-item__sale-volume").innerText.trim();
                data.saleVolume = saleVolume.match(/(\S+)\s+(\S+)\/(\S+)\s+(\S+)/) || saleVolume.match(/\((\S+)\s+(\S+)\/()(\S+)\)/);
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
