const utils = require("./utils");

const units = {
    "dávek": { unit: "kus", factor: 1 },
};

exports.getCanonical = function (item, today) {
    return utils.convertUnit(
        {
            id: "" + item.id,
            name: item.name,
            // description: "", not available
            price: item.price,
            priceHistory: [{ date: today, price: item.price }],
            unit: item.unit,
            quantity: item.quantity,
            url: item.url,
            categoryNames: item.category,
            ...(item.name && /(^K-Bio )|( bio )|(^bio )/i.test(item.name) && { bio: true }),
        },
        units,
        "kaufland"
    );
};

exports.fetchData = async function () {
    let kauflandItems = [];

    const fetchLimit = 30;
    let stUrl = `https://www.kosik.cz/api/front/page/products/flexible?slug=c5169-kaufland&limit=${fetchLimit}&order_by=price-asc&filters=kampan:hp_top`;
    let res = await fetch(stUrl);
    let json = await res.json();
    let batch = json.products.items;
    let more = JSON.stringify({ cursor: json.products.cursor, limit: fetchLimit });
    json.cursor = json.products.cursor;

    while (res.status == 200 && (json.cursor || json.products.length)) {
        for (let item of batch) {
            let itemData;
            try {
                itemData = {
                    store: "kaufland",
                    id: item.id,
                    name: item.name,
                    description: undefined,
                    price: item.price,
                    priceHistory: [],
                    unit: item.productQuantity?.unit || item.unit,
                    quantity: item.productQuantity?.value || item.unitStep,
                    url: item.url,
                    category: item.mainCategory.name,
                };
            } catch(e){
                console.log(e);
            }
            kauflandItems.push(itemData);
        }
        if (!json.cursor)
            break;
        res = await fetch("https://www.kosik.cz/api/front/products/more", {
            body: more,
            method: "POST"
        });
        json = await res.json();
        batch = json.products;
        more = JSON.stringify({ cursor: json.cursor, limit: fetchLimit });
    }

    return kauflandItems;
};

exports.initializeCategoryMapping = async () => {};

exports.mapCategory = (rawItem, item) => {
    if (item.categoryNames) return item.categoryNames;
    return null;
};
