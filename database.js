const sqlite3 = require('sqlite3').verbose();

const DBSOURCE = "db.sqlite";

// We will use bcrypt in server, but for now let's keep db simple or just rely on server to hash. 
// Actually since we are using bcrypt in server.js, we don't need md5 here for password hashing, 
// strictly speaking, but the schema needs to be created.

let db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');

        // Products Table
        db.run(`CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            price REAL,
            category TEXT,
            image TEXT,
            description TEXT,
            specs TEXT,
            stock_quantity INTEGER DEFAULT 100
        )`, (err) => {
            if (!err) {
                // Table just created, creating some rows
                console.log('Products table created, seeding data...');
                const products = generateDefaultProducts();
                const insert = 'INSERT INTO products (name, price, category, image, description, specs) VALUES (?,?,?,?,?,?)';
                products.forEach(product => {
                    db.run(insert, [product.name, product.price, product.category, product.image, product.description, product.specs]);
                });
            }
        });

        // Users Table
        db.run(`CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            email TEXT UNIQUE,
            password TEXT,
            reset_token TEXT,
            reset_token_expires INTEGER,
            full_name TEXT,
            phone TEXT,
            address TEXT,
            is_admin INTEGER DEFAULT 0
        )`, (err) => {
            if (err) {
                // Table already created
            } else {
                console.log('Users table created.');
                // Create default admin user
                const bcrypt = require('bcrypt');
                const adminPassword = 'admin123';
                bcrypt.hash(adminPassword, 10, (err, hash) => {
                    if (!err) {
                        db.run(`INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)`,
                            ['Admin', 'admin@luminary.com', hash, 1],
                            (err) => {
                                if (!err) {
                                    console.log('Default admin user created: admin@luminary.com / admin123');
                                }
                            }
                        );
                    }
                });
            }
        });

        // Cart Table
        db.run(`CREATE TABLE cart (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            product_id INTEGER,
            quantity INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        )`, (err) => {
            if (err) {
                // Table already created
            } else {
                console.log('Cart table created.');
            }
        });

        // Orders Table
        db.run(`CREATE TABLE orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            total REAL,
            status TEXT DEFAULT 'pending',
            shipping_address TEXT,
            created_at INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`, (err) => {
            if (err) {
                // Table already created
            } else {
                console.log('Orders table created.');
            }
        });

        // Order Items Table
        db.run(`CREATE TABLE order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            product_id INTEGER,
            quantity INTEGER,
            price REAL,
            FOREIGN KEY(order_id) REFERENCES orders(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        )`, (err) => {
            if (err) {
                // Table already created
            } else {
                console.log('Order Items table created.');
            }
        });
    }
});

function generateDefaultProducts() {
    const categories = [
        { name: "Tech", images: ["1519389950476-29a5e7e9ce9d", "1496181133206-80ce9b88a853", "1550009156-31ecd83eabd0", "1525547719571-a2d4ac8945e2", "1588872657578-7efd1f1555ed"] },
        { name: "Apparel", images: ["1523381210434-271e8be1f52b", "1551028919-e5af972075ba", "1542291026-7eec264c27ff", "1591561954557-26941169b49e", "1503341455253-b2e72333dbdb"] },
        { name: "Sports", images: ["1517649763962-0c623066013b", "1574680096145-d05b474e2155", "1521412644187-8498f08a422e", "1566213759905-24b8ea146eb0", "1589134764832-7236526cc6fd"] }
    ];

    const adjectives = ["Premium", "Modern", "Classic", "Essential", "Pro", "Ultra", "Sleek", "Organic", "Fresh", "Durable"];
    const productTypes = {
        "Tech": ["Laptop", "Headphones", "Smartwatch", "Camera", "Tablet", "Monitor", "Keyboard", "Mouse", "Speaker", "Charger"],
        "Apparel": ["T-Shirt", "Jeans", "Sneakers", "Jacket", "Backpack", "Cap", "Hoodie", "Scarf", "Boots", "Watch"],
        "Sports": ["Yoga Mat", "Dumbbells", "Tennis Racket", "Running Shoes", "Water Bottle", "Gym Bag", "Foam Roller", "Resistance Bands", "Basketball", "Jersey"]
    };

    let products = [];
    categories.forEach((cat, catIndex) => {
        // Generating ~170 products per category to reach 500+ total
        for (let i = 0; i < 170; i++) {
            const typeIndex = i % 10;
            const adjIndex = (i + catIndex) % adjectives.length;
            const baseImage = cat.images[i % 5];
            const typeName = productTypes[cat.name][typeIndex];

            // Add some variation to price
            const randomPrice = (Math.random() * 200 + 10).toFixed(2);

            // Add some variation to name to make them look distinct in list
            const uniqueId = i + 1;
            const name = `${adjectives[adjIndex]} ${typeName} ${uniqueId}`;

            let specs = "";
            if (cat.name === "Tech") {
                specs = "Processor: M2 Chip, RAM: 16GB, Storage: 512GB SSD, Battery: 18h";
            } else if (cat.name === "Apparel") {
                specs = "Material: 100% Cotton, Size: M, Care: Machine Wash";
            } else {
                specs = "Origin: Imported, Grade: A+, Sustainability: Eco-friendly";
            }

            products.push({
                name: name,
                price: parseFloat(randomPrice),
                category: cat.name,
                image: `https://images.unsplash.com/photo-${baseImage}?auto=format&fit=crop&q=80&w=600`,
                description: `Experience the pinnacle of ${cat.name.toLowerCase()} design with our ${name}. Crafted for performance and style, this item seamlessly integrates into your lifestyle.`,
                specs: specs
            });
        }
    });

    return products;
}

module.exports = db;
