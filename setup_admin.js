// Script to add is_admin column to existing database and create admin user
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('db.sqlite', (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        process.exit(1);
    }
    console.log('Connected to database');
});

// Add is_admin column if it doesn't exist
db.run(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`, (err) => {
    if (err) {
        if (err.message.includes('duplicate column')) {
            console.log('✓ is_admin column already exists');
        } else {
            console.error('Error adding is_admin column:', err.message);
        }
    } else {
        console.log('✓ Added is_admin column to users table');
    }

    // Check if admin user exists
    db.get(`SELECT * FROM users WHERE email = 'admin@luminary.com'`, (err, row) => {
        if (err) {
            console.error('Error checking for admin user:', err);
            db.close();
            return;
        }

        if (row) {
            // Update existing user to be admin
            db.run(`UPDATE users SET is_admin = 1 WHERE email = 'admin@luminary.com'`, (err) => {
                if (err) {
                    console.error('Error updating admin user:', err);
                } else {
                    console.log('✓ Updated existing admin@luminary.com to admin');
                }
                db.close();
                console.log('\nAdmin setup complete!');
                console.log('Login credentials: admin@luminary.com / admin123');
            });
        } else {
            // Create new admin user
            const adminPassword = 'admin123';
            bcrypt.hash(adminPassword, 10, (err, hash) => {
                if (err) {
                    console.error('Error hashing password:', err);
                    db.close();
                    return;
                }

                db.run(`INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)`,
                    ['Admin', 'admin@luminary.com', hash, 1],
                    (err) => {
                        if (err) {
                            console.error('Error creating admin user:', err);
                        } else {
                            console.log('✓ Created new admin user: admin@luminary.com');
                        }
                        db.close();
                        console.log('\nAdmin setup complete!');
                        console.log('Login credentials: admin@luminary.com / admin123');
                    }
                );
            });
        }
    });
});
