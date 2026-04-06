const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('db.sqlite');

db.get("SELECT Count(*) as count FROM products", (err, row) => {
    if (err) {
        console.error("Error:", err.message);
    } else {
        console.log("Product Count:", row.count);
    }
});
