const fs = require("fs");

(function () // merge all unpacked JSON history files
{
    let files = fs.readdirSync("stores/t");
    let otpt = {};
    let prevFile = cutDate(files[0]);
    let maxChanges = 0;
    for (let f of files) {
        let json = fs.readFileSync(`stores/t/${f}`).toString();
        json = json
            .replace(/&#x27;/g, "'")
            .replace(/&amp;/g, "&")
            .replace(/&#x3D;/g, "=")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">");
        json = JSON.parse(json);
        for (let i of json) {
            if (!otpt[i.id]) otpt[i.id] = i;
            else {
                let old = otpt[i.id];
                if (old == undefined) {
                    otpt[i.id] = i;
                }
                if (!old.priceHistory.length) {
                    old.priceHistory.push({ date: prevFile, price: old.price });
                }
                if (i.categoryNames) {
                    i.category = i.categoryNames;
                    delete i.categoryNames;
                }
                if (i.description == undefined) {
                    delete old.description;
                }
                if (i.name != old.name || i.unit.toLocaleLowerCase() != old.unit.toLocaleLowerCase() || i.quantity != old.quantity) {
                    const lg = [old.name, old.unit, old.quantity, i.name, i.unit, i.quantity];
                    console.log(lg);
                    //debugger;
                }
                if (i.price != old.priceHistory.slice(-1)[0].price) {
                    old.priceHistory.push({ date: cutDate(f), price: i.price });
                    if (maxChanges < old.priceHistory.length) maxChanges = old.priceHistory.length;
                    //if (maxChanges == 4) debugger;
                }
                old.unit = i.unit;
                old.category = i.category;
                old.description = i.description;
                old.quantity == i.quantity;
            }
        }
        prevFile = cutDate(f);
    }
    let o2 = [];
    for (let i in otpt) o2.push(otpt[i]);
    fs.writeFileSync("stores/tesco.json", JSON.stringify(o2, 0, 1));
})();

function cutDate(d) {
    return d.match(/[a-z]+-([\d-]+)\./)[1];
}
