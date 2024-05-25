const misc = require("../js/misc");
const { Model } = require("./model");

class Carts extends Model {
    constructor() {
        super();
        this._carts = [];
    }

    get carts() {
        return this._carts;
    }

    async load(itemsLookup) {
        const val = localStorage.getItem("carts");
        let carts = (this._carts = val ? JSON.parse(val) : []);

        const oldCarts = {
            "Markenprodukte Billa/Spar": 0,
            "Diskont-Marken Produkte Billa/Spar": 0,
            "Bio Eigenmarken Produkte Billa/Spar": 0,
            "Mittelpreisige Eigenmarken Produkte Billa/Spar": 0,
            "Momentum Eigenmarken Vergleich": 0,
        };
        let remove = carts.filter((cart) => oldCarts[cart.name] == 0);
        for (let c of remove) {
            if (c.items.length == 0) {
                this.remove(c.name);
            }
        }

        if (!localStorage.getItem("updatedKnnCarts")) {
            localStorage.setItem("updatedKnnCarts", "true");
            carts = this._carts = carts.filter((cart) => cart.name != "Spotřební koš - Albert");
            carts = this._carts = carts.filter((cart) => cart.name != "Spotřební koš - Billa");
            carts = this._carts = carts.filter((cart) => cart.name != "Spotřební koš - Globus");
            carts = this._carts = carts.filter((cart) => cart.name != "Spotřební koš - Tesco");
        }

        const predefinedCarts = [
            "Spotřební koš - Tesco",
            "Spotřební koš - Globus",
            "Spotřební koš - Billa",
            "Spotřební koš - Albert",
            "Spotřební koš - Tesco(86)",
            "Spotřební koš - Globus(86)",
            "Spotřební koš - Billa(86)",
            "Spotřební koš - Albert(86)",
        ];
        for (let n of predefinedCarts) {
            let fileName = `data/${n
                .match(/[\S]+$/)[0]
                .toLowerCase()
                .replace(/[\(\)]/g, "")}-cart.json`;
            let cartItem = carts.find((cart) => cart.name == n);
            const cart = await misc.fetchJSON(fileName);
            if (cartItem == undefined) {
                carts.unshift(cart);
            } else {
                for (let i of cartItem.items) {
                    i.quantity = cart.items.find((j) => j.id == i.id).quantity;
                }
            }
        }

        // Update items in cart to their latest version.
        for (const cart of carts) {
            const items = [];
            for (const cartItem of cart.items) {
                const item = itemsLookup[cartItem.store + cartItem.id];
                if (item) {
                    if (cartItem.quantity != item.quantity && cartItem.unit == item.unit) {
                        const coef = cartItem.quantity / item.quantity;
                        item.price *= coef;
                        item.quantity = Math.round(item.quantity * coef);
                        for (let h of item.priceHistory) {
                            h.price *= coef;
                        }
                    }
                    items.push(item);
                }
            }
            cart.items = items;
        }
        this.save();
    }

    save() {
        const carts = [];
        for (const cart of this._carts) {
            carts.push({
                name: cart.name,
                items: cart.items.map((item) => {
                    return { store: item.store, id: item.id, quantity: item.quantity, unit: item.unit };
                }),
            });
        }
        localStorage.setItem("carts", JSON.stringify(carts, null, 2));
        this.notify();
    }

    add(name) {
        this._carts.push({ name: name, items: [] });
        this.save();
    }

    remove(name) {
        this._carts = this._carts.filter((cart) => cart.name !== name);
        this.save();
    }
}

exports.Carts = Carts;
