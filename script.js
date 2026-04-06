document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let products = [];
    let cart = [];

    // --- Constants ---
    const STORAGE_KEY = 'luminary_products_v2'; // Bump version for new schema
    const AUTH_TOKEN_KEY = 'luminary_auth_token';
    const USER_DATA_KEY = 'luminary_user_data';
    const THEME_KEY = 'luminary_theme';

    // --- Functions ---

    // Theme Logic
    function initializeTheme() {
        const savedTheme = localStorage.getItem(THEME_KEY);
        // Default to light mode, or use saved preference
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            document.body.classList.remove('light-mode');
        } else {
            document.body.classList.add('light-mode');
            document.body.classList.remove('dark-mode');
        }
        updateThemeIcon();
    }

    function toggleTheme() {
        const isDark = document.body.classList.contains('dark-mode');
        if (isDark) {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
            localStorage.setItem(THEME_KEY, 'light');
        } else {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
            localStorage.setItem(THEME_KEY, 'dark');
        }
        updateThemeIcon();
    }

    function updateThemeIcon() {
        const isDark = document.body.classList.contains('dark-mode');
        const sunIcon = document.getElementById('theme-icon-sun');
        const moonIcon = document.getElementById('theme-icon-moon');

        if (sunIcon && moonIcon) {
            // Show sun icon in dark mode (to switch to light), moon in light mode (to switch to dark)
            if (isDark) {
                sunIcon.style.display = 'block';
                moonIcon.style.display = 'none';
            } else {
                sunIcon.style.display = 'none';
                moonIcon.style.display = 'block';
            }
        }

        const btn = document.getElementById('theme-toggle');
        if (btn) {
            btn.setAttribute('aria-label', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
        }
    }

    function injectThemeToggle() {
        // Theme toggle is now in HTML, just attach event listener
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
            updateThemeIcon();
        }
    }

    // Check Auth State
    function checkAuth() {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        const user = JSON.parse(localStorage.getItem(USER_DATA_KEY) || '{}');
        updateAuthUI(token, user);
    }

    function updateAuthUI(token, user) {
        const navLinks = document.querySelector('.nav-links');
        const authLink = document.getElementById('auth-link');

        // Remove existing auth link if any to avoid duplicates (though we usually have static or none)
        if (authLink) authLink.remove();

        const li = document.createElement('li');
        li.id = 'auth-link';

        if (token) {
            // Logged In
            li.innerHTML = `
                <a href="profile.html" style="margin-right: 15px;">Profile</a>
                <a href="#" id="logout-btn">Logout (${user.username})</a>
            `;
            navLinks.appendChild(li);
            document.getElementById('logout-btn').addEventListener('click', (e) => {
                e.preventDefault();
                logout();
            });
        } else {
            // Logged Out
            const path = window.location.pathname;
            if (!path.includes('login.html') && !path.includes('register.html')) {
                li.innerHTML = `<a href="login.html">Login</a>`;
                navLinks.appendChild(li);
            }
        }
    }

    function logout() {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(USER_DATA_KEY);
        // Clear cart on logout to prevent data leak, or keep it if you want guest cart?
        // Let's clear it for safety as requested "specific user delete them"
        cart = [];
        window.location.href = 'index.html';
    }

    // --- Functions ---

    // Initialize Data (Load from API)
    function initializeData() {
        fetch('http://localhost:3000/api/products')
            .then(response => response.json())
            .then(json => {
                products = json.data;

                // Load Cart (Server or Local)
                const token = localStorage.getItem(AUTH_TOKEN_KEY);
                const path = window.location.pathname;

                if (token) {
                    fetch('http://localhost:3000/api/cart', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                        .then(res => res.json())
                        .then(data => {
                            if (data.message === 'success') {
                                cart = data.cart;
                                updateCartUI();
                            }
                            // Render pages AFTER cart is loaded
                            renderPage(path);
                        })
                        .catch(err => {
                            console.error("Error fetching cart:", err);
                            // Render pages even if cart fails
                            renderPage(path);
                        });
                } else {
                    // No token, render immediately
                    renderPage(path);
                }
            })
            .catch(err => console.error("Error fetching products:", err));
    }

    function renderPage(path) {
        if (path.includes('product-detail.html')) {
            renderProductDetail();
        } else if (path.includes('profile.html')) {
            initProfilePage();
        } else if (path.includes('checkout.html')) {
            initCheckoutPage();
        } else {
            renderProducts();
        }
        renderAdminPanel();
    }

    // --- DOM Elements ---
    const productGrid = document.getElementById('product-grid');
    const productDetailContainer = document.getElementById('product-detail-container');
    const cartBtn = document.getElementById('cart-btn');
    const closeCartBtn = document.getElementById('close-cart');
    const cartSidebar = document.getElementById('cart-sidebar');
    const cartOverlay = document.getElementById('cart-overlay');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartTotalPrice = document.getElementById('cart-total-price');

    // Filter & Sort
    const categoryFilter = document.getElementById('category-filter');
    const sortFilter = document.getElementById('sort-filter');
    const searchInput = document.querySelector('.search-bar input');

    // Admin Elements
    const adminProductList = document.getElementById('admin-product-list');
    const addProductForm = document.getElementById('add-product-form');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const formSubmitBtn = document.getElementById('form-submit-btn');

    // --- State Vars for filtering ---
    let currentCategory = 'all';
    let currentSort = 'default';
    let searchTerm = '';

    // --- Run Initialization ---
    initializeTheme(); // Run immediately to prevent flash
    initializeData();
    checkAuth();
    injectThemeToggle();

    // Determine Page
    const path = window.location.pathname;

    // Initial renders are now handled inside initializeData()'s fetch callback
    // But we need to check for search params here to pre-pop state
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam) {
        searchTerm = searchParam.toLowerCase();
        if (searchInput) searchInput.value = searchParam;
    }

    // --- Event Listeners ---
    if (cartBtn) cartBtn.addEventListener('click', toggleCart);
    if (closeCartBtn) closeCartBtn.addEventListener('click', toggleCart);
    if (cartOverlay) cartOverlay.addEventListener('click', toggleCart);

    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            currentCategory = e.target.value;
            renderProducts();
        });
    }

    if (sortFilter) {
        sortFilter.addEventListener('change', (e) => {
            currentSort = e.target.value;
            renderProducts();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            // Only real-time filter on pages with product grid
            if (productGrid || path.includes('index.html') || path.includes('products.html')) {
                searchTerm = e.target.value.toLowerCase();
                renderProducts();
            }
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const term = searchInput.value.trim();
                if (term) {
                    // If not on a product page, or if we want to confirm search
                    if (!productGrid && !path.includes('index.html') && !path.includes('products.html')) {
                        window.location.href = `products.html?search=${encodeURIComponent(term)}`;
                    } else {
                        // On product page, input listener handles it, just blur
                        searchInput.blur();
                    }
                }
            }
        });
    }

    if (addProductForm) {
        addProductForm.addEventListener('submit', handleAdminFormSubmit);
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', resetAdminForm);
    }

    // --- Auth Form Logic ---
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.message === 'success') {
                        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
                        localStorage.setItem(USER_DATA_KEY, JSON.stringify(data.user));
                        window.location.href = 'index.html';
                    } else {
                        alert('Login failed: ' + data.error);
                    }
                })
                .catch(err => alert('Error logging in'));
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            fetch('http://localhost:3000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.message === 'success') {
                        alert('Registration successful! Please login.');
                        window.location.href = 'login.html';
                    } else {
                        alert('Registration failed: ' + data.error);
                    }
                })
                .catch(err => alert('Error registering'));
        });
    }

    if (forgotPasswordForm) {
        let step = 1;
        forgotPasswordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;

            if (step === 1) {
                // Request Token
                fetch('http://localhost:3000/api/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.message) {
                            alert(data.message + "\n\nCHECK BROWSER CONSOLE FOR TOKEN!");
                            console.log("==========================================");
                            console.log("SIMULATED EMAIL - RESET TOKEN:", data.token);
                            console.log("==========================================");
                            step = 2;
                            document.getElementById('reset-section').style.display = 'block';
                            document.getElementById('email').disabled = true;
                            document.getElementById('submit-btn').textContent = 'Reset Password';
                        } else {
                            alert('Error: ' + data.error);
                        }
                    });
            } else {
                // Reset Password
                const token = document.getElementById('token').value;
                const newPassword = document.getElementById('new-password').value;

                fetch('http://localhost:3000/api/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, newPassword })
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.message === 'Password updated successfully') {
                            alert('Password reset successful! Please login.');
                            window.location.href = 'login.html';
                        } else {
                            alert('Error: ' + data.error);
                        }
                    });
            }
        });
    }

    // --- Profile Page Logic ---
    function initProfilePage() {
        const profileForm = document.getElementById('profile-form');
        const logoutBtn = document.getElementById('logout-btn-profile');

        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                logout();
            });
        }

        // Load Data
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        fetch('http://localhost:3000/api/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(res => {
                if (res.message === 'success') {
                    const user = res.data;
                    document.getElementById('profile-email').value = user.email;
                    document.getElementById('profile-name').value = user.full_name || '';
                    document.getElementById('profile-phone').value = user.phone || '';
                    document.getElementById('profile-address').value = user.address || '';
                }
            });

        // Save Data
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const full_name = document.getElementById('profile-name').value;
                const phone = document.getElementById('profile-phone').value;
                const address = document.getElementById('profile-address').value;

                fetch('http://localhost:3000/api/profile', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ full_name, phone, address })
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.message === 'Profile updated successfully') {
                            alert('Profile updated!');
                        } else {
                            alert('Error: ' + data.error);
                        }
                    });
            });
        }
    }

    // --- Checkout Page Logic ---
    function initCheckoutPage() {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        const checkoutContent = document.getElementById('checkout-content');
        if (!checkoutContent) return;

        // Check if cart is empty
        if (cart.length === 0) {
            checkoutContent.innerHTML = `
                <div class="empty-cart-message">
                    <h2>Your cart is empty</h2>
                    <p>Add some items to your cart before checking out.</p>
                    <a href="products.html" class="btn btn-primary" style="margin-top: 1rem;">Continue Shopping</a>
                </div>
            `;
            return;
        }

        // Load user profile for shipping info
        fetch('http://localhost:3000/api/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(res => {
                const user = res.data || {};
                renderCheckoutPage(user);
            })
            .catch(err => {
                console.error("Error loading profile:", err);
                renderCheckoutPage({});
            });
    }

    function renderCheckoutPage(user) {
        const checkoutContent = document.getElementById('checkout-content');
        const total = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

        checkoutContent.innerHTML = `
            <div class="checkout-container">
                <div class="checkout-form">
                    <h2>Checkout</h2>
                    <form id="checkout-form">
                        <div class="form-section">
                            <h3>Shipping Information</h3>
                            <div class="form-group">
                                <label>Full Name *</label>
                                <input type="text" id="ship-name" value="${user.full_name || ''}" required>
                            </div>
                            <div class="form-group">
                                <label>Phone Number *</label>
                                <input type="tel" id="ship-phone" value="${user.phone || ''}" required>
                            </div>
                            <div class="form-group">
                                <label>Shipping Address *</label>
                                <textarea id="ship-address" required>${user.address || ''}</textarea>
                            </div>
                        </div>

                        <div class="form-section">
                            <h3>Payment Information</h3>
                            <div class="form-group">
                                <label>Card Number *</label>
                                <input type="text" id="card-number" placeholder="1234 5678 9012 3456" maxlength="19" required>
                                <div class="card-icons">
                                    <div class="card-icon">VISA</div>
                                    <div class="card-icon">MC</div>
                                    <div class="card-icon">AMEX</div>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Expiry Date *</label>
                                    <input type="text" id="card-expiry" placeholder="MM/YY" maxlength="5" required>
                                </div>
                                <div class="form-group">
                                    <label>CVV *</label>
                                    <input type="text" id="card-cvv" placeholder="123" maxlength="4" required>
                                </div>
                            </div>
                            <p style="color: var(--color-text-muted); font-size: 0.9rem; margin-top: 0.5rem;">
                                <strong>Note:</strong> This is a simulated payment. No actual charges will be made.
                            </p>
                        </div>

                        <button type="submit" class="place-order-btn">Place Order - $${total.toFixed(2)}</button>
                    </form>
                </div>

                <div class="order-summary">
                    <h2>Order Summary</h2>
                    <div id="checkout-items">
                        ${cart.map((item, index) => `
                            <div class="summary-item">
                                <img src="${item.image}" alt="${item.name}">
                                <div class="summary-item-details">
                                    <div class="summary-item-name">${item.name}</div>
                                    <div class="summary-item-price">$${item.price.toFixed(2)}</div>
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                                        <label style="font-size: 0.9rem; color: var(--color-text-muted);">Qty:</label>
                                        <input type="number" min="1" max="99" value="${item.quantity || 1}" 
                                               onchange="updateCheckoutQuantity(${index}, this.value)"
                                               style="width: 60px; padding: 0.25rem; border: 1px solid var(--color-light-gray); border-radius: 4px;">
                                        <button onclick="removeFromCheckout(${index})" 
                                                style="margin-left: auto; padding: 0.25rem 0.75rem; background: var(--color-coral-red); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="summary-total">
                        <span>Total:</span>
                        <span id="checkout-total">$${total.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;

        // Add form submission handler
        const checkoutForm = document.getElementById('checkout-form');
        if (checkoutForm) {
            checkoutForm.addEventListener('submit', handleCheckoutSubmit);
        }

        // Add card number formatting
        const cardNumberInput = document.getElementById('card-number');
        if (cardNumberInput) {
            cardNumberInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\s/g, '');
                let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
                e.target.value = formattedValue;
            });
        }

        // Add expiry formatting
        const expiryInput = document.getElementById('card-expiry');
        if (expiryInput) {
            expiryInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length >= 2) {
                    value = value.slice(0, 2) + '/' + value.slice(2, 4);
                }
                e.target.value = value;
            });
        }
    }

    // Update quantity on checkout page
    window.updateCheckoutQuantity = function (index, newQuantity) {
        const qty = parseInt(newQuantity);
        if (qty < 1) return;

        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        const item = cart[index];

        if (token && item.id) {
            // Update on server
            fetch('http://localhost:3000/api/cart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ product_id: item.id, quantity: qty })
            })
                .then(res => res.json())
                .then(() => {
                    // Reload cart and re-render checkout
                    fetch('http://localhost:3000/api/cart', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                        .then(res => res.json())
                        .then(data => {
                            if (data.message === 'success') {
                                cart = data.cart;
                                updateCartUI();
                                // Re-render checkout page with updated cart
                                fetch('http://localhost:3000/api/profile', {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                })
                                    .then(res => res.json())
                                    .then(res => {
                                        const user = res.data || {};
                                        renderCheckoutPage(user);
                                    });
                            }
                        });
                });
        }
    };

    // Remove item from checkout
    window.removeFromCheckout = function (index) {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        const item = cart[index];

        if (token && item.id) {
            // Remove from server
            fetch(`http://localhost:3000/api/cart/${item.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (data.message === 'Item removed from cart') {
                        cart.splice(index, 1);
                        updateCartUI();

                        // Check if cart is now empty
                        if (cart.length === 0) {
                            initCheckoutPage(); // Will show empty cart message
                        } else {
                            // Re-render checkout page
                            fetch('http://localhost:3000/api/profile', {
                                headers: { 'Authorization': `Bearer ${token}` }
                            })
                                .then(res => res.json())
                                .then(res => {
                                    const user = res.data || {};
                                    renderCheckoutPage(user);
                                });
                        }
                    }
                });
        }
    };

    function handleCheckoutSubmit(e) {
        e.preventDefault();

        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        if (!token) {
            alert('Please login to complete checkout');
            window.location.href = 'login.html';
            return;
        }

        // Gather form data
        const shipping_address = `
Name: ${document.getElementById('ship-name').value}
Phone: ${document.getElementById('ship-phone').value}
Address: ${document.getElementById('ship-address').value}
        `.trim();

        const payment_method = {
            card_number: document.getElementById('card-number').value,
            expiry: document.getElementById('card-expiry').value,
            cvv: document.getElementById('card-cvv').value
        };

        console.log('Submitting checkout with:', { shipping_address, payment_method });

        // Submit order
        fetch('http://localhost:3000/api/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ shipping_address, payment_method })
        })
            .then(res => {
                console.log('Checkout response status:', res.status);
                return res.json();
            })
            .then(data => {
                console.log('Checkout response data:', data);
                if (data.message === 'Order placed successfully') {
                    // Clear local cart
                    cart = [];
                    updateCartUI();

                    // Show success message
                    alert(`Order placed successfully! Order ID: ${data.order_id}\nTotal: $${data.total.toFixed(2)}`);
                    window.location.href = 'index.html';
                } else {
                    // Show detailed error message
                    const errorMsg = data.error || 'Unknown error';
                    console.error('Checkout error:', errorMsg);
                    alert('Failed to place order: ' + errorMsg);
                }
            })
            .catch(err => {
                console.error('Checkout error:', err);
                alert('Failed to place order. Please try again.\nError: ' + err.message);
            });
    }

    // --- Admin Form Logic ---
    function handleAdminFormSubmit(e) {
        e.preventDefault();
        const idInput = document.getElementById('p-id').value;
        const name = document.getElementById('p-name').value;
        const price = parseFloat(document.getElementById('p-price').value);
        const category = document.getElementById('p-category').value;
        const image = document.getElementById('p-image').value;
        const desc = document.getElementById('p-desc').value;
        const specs = document.getElementById('p-specs').value;

        const productData = { name, price, category, image, description: desc, specs: specs };

        if (idInput) {
            // EDIT Mode
            const id = parseInt(idInput);
            fetch(`http://localhost:3000/api/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            })
                .then(res => res.json())
                .then(res => {
                    if (res.message === 'success') {
                        alert('Product Updated!');
                        initializeData(); // Reload data
                        resetAdminForm();
                    } else {
                        alert('Error updating product: ' + res.error);
                    }
                });
        } else {
            // ADD Mode
            fetch('http://localhost:3000/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            })
                .then(res => res.json())
                .then(res => {
                    if (res.message === 'success') {
                        alert('Product Added!');
                        initializeData(); // Reload data
                        resetAdminForm();
                    } else {
                        alert('Error adding product: ' + res.error);
                    }
                });
        }
    }

    function resetAdminForm() {
        addProductForm.reset();
        document.getElementById('p-id').value = '';
        formSubmitBtn.textContent = 'Add Product';
        if (cancelEditBtn) cancelEditBtn.style.display = 'none';
        document.querySelector('h2').textContent = 'Add New Product';
    }


    // OLD editProduct function - DISABLED to prevent conflict with admin.html
    // The new admin dashboard uses its own editProduct function defined in admin.html
    /*
    window.editProduct = (id) => {
        const product = products.find(p => p.id === id);
        if (product) {
            document.getElementById('p-id').value = product.id;
            document.getElementById('p-name').value = product.name;
            document.getElementById('p-price').value = product.price;
            document.getElementById('p-category').value = product.category;
            document.getElementById('p-image').value = product.image;
            document.getElementById('p-desc').value = product.description || '';
            document.getElementById('p-specs').value = product.specs || '';

            formSubmitBtn.textContent = 'Update Product';
            if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block';
            document.querySelector('h2').textContent = 'Edit Product';

            // Scroll to form
            addProductForm.scrollIntoView({ behavior: 'smooth' });
        }
    };
    */


    // --- Rendering Logic ---

    function renderProducts() {
        if (!productGrid) return;

        // Don't render on detail page or collections page if specific logic exists
        if (path.includes('collections.html')) return; // Simple bypass

        // 1. Filter
        let filteredProducts = products;
        if (currentCategory !== 'all') {
            filteredProducts = products.filter(p => p.category === currentCategory);
        }

        // 1.5 Search Filter
        if (searchTerm) {
            filteredProducts = filteredProducts.filter(p =>
                p.name.toLowerCase().includes(searchTerm) ||
                (p.description && p.description.toLowerCase().includes(searchTerm))
            );
        }

        // 2. Sort
        if (currentSort === 'price-asc') {
            filteredProducts.sort((a, b) => a.price - b.price);
        } else if (currentSort === 'price-desc') {
            filteredProducts.sort((a, b) => b.price - a.price);
        } else if (currentSort === 'name-asc') {
            filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
        } else if (currentSort === 'name-desc') {
            filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
        }

        // 3. Page Logic: Homepage vs Products Page
        const isHomePage = path.endsWith('index.html') || path.endsWith('/');
        if (isHomePage) {
            // Homepage logic: Featured
            if (currentCategory === 'all' && currentSort === 'default') {
                filteredProducts = [...products].sort(() => 0.5 - Math.random()).slice(0, 8);
            }
        }

        // 4. Render
        productGrid.innerHTML = filteredProducts.map(product => `
            <div class="product-card" onclick="location.href='product-detail.html?id=${product.id}'" style="cursor: pointer;">
                <div class="product-image">
                    <img src="${product.image}" loading="lazy" alt="${product.name}" onerror="this.src='https://placehold.co/600x400?text=No+Image'">
                </div>
                <div class="product-info">
                    <span style="font-size: 0.8rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px;">${product.category}</span>
                    <h3 class="product-title">${product.name}</h3>
                    <p class="product-price">$${product.price.toFixed(2)}</p>
                    <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart(${product.id})">
                        Add to Cart
                    </button>
                </div>
            </div>
        `).join('');
    }

    function renderProductDetail() {
        if (!productDetailContainer) return;

        const urlParams = new URLSearchParams(window.location.search);
        const id = parseInt(urlParams.get('id'));
        const product = products.find(p => p.id === id);

        if (!product) {
            productDetailContainer.innerHTML = '<p>Product not found.</p>';
            return;
        }

        productDetailContainer.innerHTML = `
            <div style="flex: 1; min-width: 300px;">
                 <img src="${product.image}" alt="${product.name}" style="width: 100%; border-radius: 8px; box-shadow: var(--shadow-md);">
            </div>
            <div style="flex: 1; min-width: 300px; display: flex; flex-direction: column; justify-content: center;">
                 <span style="font-size: 0.9rem; color: var(--color-electric-blue); text-transform: uppercase; font-weight: 600; margin-bottom: 0.5rem;">${product.category}</span>
                 <h1 style="font-size: 2.5rem; margin-bottom: 1rem;">${product.name}</h1>
                 <p style="font-size: 1.5rem; font-weight: 700; color: var(--color-slate-gray); margin-bottom: 1.5rem;">$${product.price.toFixed(2)}</p>
                 
                 <div style="margin-bottom: 2rem; line-height: 1.8; color: var(--color-text-muted);">
                    <p>${product.description || 'No description available.'}</p>
                 </div>
                 
                 <div style="margin-bottom: 2rem;">
                     <h3 style="margin-bottom: 0.5rem;">Specifications</h3>
                     <p style="color: var(--color-text-muted);">${product.specs || 'N/A'}</p>
                 </div>
                 
                 <button class="btn btn-primary" style="align-self: start; padding: 1rem 3rem;" onclick="addToCart(${product.id})">Add to Cart</button>
            </div>
        `;
    }

    function renderAdminPanel() {
        if (!adminProductList) return;

        adminProductList.innerHTML = products.map(product => `
            <tr>
                <td>${product.id}</td>
                <td><img src="${product.image}" width="50" height="50" style="object-fit:cover; border-radius:4px;"></td>
                <td style="font-weight:600;">${product.name}</td>
                <td>${product.category}</td>
                <td>$${product.price.toFixed(2)}</td>
                <td>
                     <a href="product-detail.html?id=${product.id}" target="_blank" class="user-view-btn">View</a>
                     <button class="btn btn-edit" onclick="editProduct(${product.id})">Edit</button>
                    <button class="btn btn-delete" onclick="deleteProduct(${product.id})">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    // --- Global Actions ---

    window.addToCart = (id) => {
        const product = products.find(p => p.id === id);
        if (product) {
            const token = localStorage.getItem(AUTH_TOKEN_KEY);
            if (token) {
                // Server Side Cart
                fetch('http://localhost:3000/api/cart', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ product_id: id, quantity: 1 })
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.message === 'Item added to cart' || data.message === 'Item already in cart') {
                            // Optimistic update or re-fetch? Let's just push to local state for speed
                            // But wait, if we push to local state, we need to match server structure?
                            // Server returns {message, id}.
                            // Let's just re-fetch cart to be safe and simple
                            return fetch('http://localhost:3000/api/cart', {
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                        }
                    })
                    .then(res => res && res.json())
                    .then(data => {
                        if (data && data.message === 'success') {
                            cart = data.cart;
                            updateCartUI();
                            openCart();
                        }
                    });
            } else {
                // Local Storage Cart (Guest)
                // We should technically support guest cart, but user asked for "when reloadinng the site that all should not removed from the acconut"
                // which implies logged in. Guests usually use localStorage.
                cart.push(product);
                updateCartUI();
                openCart();
            }
        }
    };

    window.removeFromCart = (index) => {
        const item = cart[index];
        const token = localStorage.getItem(AUTH_TOKEN_KEY);

        if (token) {
            // Server Side Remove
            // We need product ID. 
            // NOTE: The cart array from server has 'id' as product_id.
            // The item from local push has 'id' as product_id too.
            fetch(`http://localhost:3000/api/cart/${item.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (data.message === 'Item removed from cart') {
                        cart.splice(index, 1);
                        updateCartUI();
                    }
                });
        } else {
            cart.splice(index, 1);
            updateCartUI();
        }
    };


    // OLD deleteProduct function - DISABLED to prevent conflict with admin.html
    /*
    window.deleteProduct = (id) => {
        if (confirm('Are you sure you want to delete this product?')) {
            fetch(`http://localhost:3000/api/products/${id}`, {
                method: 'DELETE'
            })
                .then(res => res.json())
                .then(res => {
                    if (res.message === 'deleted') {
                        initializeData(); // Reload data
                    } else {
                        alert('Error deleting product');
                    }
                });
        }
    };
    */


    function updateCartUI() {
        if (!cartCount || !cartItemsContainer || !cartTotalPrice) return;
        cartCount.textContent = cart.length;
        const total = cart.reduce((sum, item) => sum + item.price, 0);
        cartTotalPrice.textContent = '$' + total.toFixed(2);

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-msg">Your cart is empty.</p>';
        } else {
            cartItemsContainer.innerHTML = cart.map((item, index) => `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}" class="cart-item-img">
                    <div class="cart-item-details">
                        <h4 class="cart-item-title">${item.name}</h4>
                        <p class="cart-item-price">$${item.price.toFixed(2)}</p>
                        <button class="cart-item-remove" onclick="removeFromCart(${index})">Remove</button>
                    </div>
                </div>
            `).join('');
        }
    }

    function toggleCart() {
        cartSidebar.classList.toggle('open');
        if (cartSidebar.classList.contains('open')) {
            cartOverlay.classList.add('open');
            document.body.style.overflow = 'hidden';
        } else {
            cartOverlay.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    function openCart() {
        if (!cartSidebar.classList.contains('open')) {
            toggleCart();
        }
    }
});
