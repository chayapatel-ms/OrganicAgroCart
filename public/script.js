let products = [];
let selectedCategory = "All";
let cart = [];

// Safely display text received from the API.
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// Safely read saved user information.
function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem("agrocartUser") || "null");
  } catch {
    return null;
  }
}

// Load approved products from the Express API.
async function fetchProducts() {
  const grid = document.getElementById("product-grid");
  const emptyMessage = document.getElementById("empty-message");

  grid.innerHTML = "<p>Loading fresh products...</p>";

  try {
    const response = await fetch("/api/products");

    if (!response.ok) {
      throw new Error("Unable to fetch products from the server.");
    }

    const data = await response.json();

    if (!data.success || !Array.isArray(data.products)) {
      throw new Error(data.message || "Invalid product data.");
    }

    products = data.products
      .filter(product => product.verificationStatus === "approved")
      .map(product => {
        const farmerValue =
          product.farmerName ||
          (
            product.farmer &&
            typeof product.farmer === "object"
              ? product.farmer.name
              : product.farmer
          );

        const farmerName =
          typeof farmerValue === "string" &&
          farmerValue.trim() &&
          !/^[a-f\d]{24}$/i.test(farmerValue.trim())
            ? farmerValue.trim()
            : "Local Farmer";

        return {
          id: String(product._id),
          name: String(product.name || "Unnamed Product"),
          category: String(product.category || "Vegetables"),
          price: Number(product.price) || 0,
          unit: String(product.unit || "kg"),
          emoji: String(product.emoji || "🌱"),
          image: String(product.image || product.imageUrl || ""),
          farmer: farmerName,
          location: String(
            product.location || "Location not provided"
          ),
          verification: product.verificationStatus,
          organicVerificationStatus:
            product.organicDetails?.organicVerificationStatus ||
            "not_submitted"
        };
      });

    cart = loadCart();

    renderProducts();
    renderCart();
  } catch (error) {
    console.error("Product loading error:", error);

    grid.innerHTML = `
      <p>Unable to load products. Please refresh the page.</p>
    `;

    emptyMessage.hidden = true;
  }
}

// Load saved cart from the browser.
function loadCart() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("agroCart") || "[]"
    );

    if (!Array.isArray(saved)) return [];

    return saved
      .filter(item =>
        item &&
        products.some(product => product.id === String(item.id)) &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 99
      )
      .map(item => ({
        id: String(item.id),
        quantity: item.quantity
      }));
  } catch {
    return [];
  }
}

// Save cart to the browser.
function saveCart() {
  localStorage.setItem("agroCart", JSON.stringify(cart));
}

// Display products with search and category filters.
function renderProducts() {
  const searchInput = document.getElementById("search-input");
  const grid = document.getElementById("product-grid");
  const emptyMessage = document.getElementById("empty-message");
  const resultsCount = document.getElementById("results-count");

  const search = searchInput.value.trim().toLowerCase();

  const filteredProducts = products.filter(product => {
    const matchesCategory =
      selectedCategory === "All" ||
      product.category === selectedCategory;

    const matchesSearch =
      product.name.toLowerCase().includes(search) ||
      product.farmer.toLowerCase().includes(search) ||
      product.location.toLowerCase().includes(search);

    return matchesCategory && matchesSearch;
  });

  resultsCount.textContent =
    `${filteredProducts.length} product(s) found`;

  emptyMessage.hidden = filteredProducts.length !== 0;

  if (filteredProducts.length === 0) {
    grid.innerHTML = "";
    return;
  }

  grid.innerHTML = filteredProducts.map(product => {
    const organicStatus =
      product.organicVerificationStatus || "not_submitted";

    const organicStatusText = {
      not_submitted: "ℹ️ Organic claim not submitted",
      pending: "⏳ Organic verification pending",
      verified: "🌿 Organic claim verified",
      rejected: "❌ Organic claim rejected"
    }[organicStatus] || "ℹ️ Organic status unavailable";

    return `
      <article class="product-card">
        <div class="product-art">
          ${
            product.image
              ? `<img
                   class="product-image"
                   src="${escapeHTML(product.image)}"
                   alt="${escapeHTML(product.name)}"
                   loading="lazy"
                   onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                 >`
              : ""
          }

          <span
            class="product-emoji"
            aria-hidden="true"
            style="${product.image ? "display:none;" : ""}"
          >${escapeHTML(product.emoji)}</span>

          <span class="product-category">
            ${escapeHTML(product.category)}
          </span>
        </div>

        <div class="product-details">
          <h3>${escapeHTML(product.name)}</h3>

          <p class="farmer-name">
            👨‍🌾 Farmer: ${escapeHTML(product.farmer)}
          </p>

          <p class="farm-location">
            📍 ${escapeHTML(product.location)}
          </p>

          <div class="product-verification-status">
            <span class="verification approved">
              ✅ Approved for sale
            </span>

            <span class="organic-verification ${escapeHTML(organicStatus)}">
              ${organicStatusText}
            </span>
          </div>

          <div class="product-bottom">
            <p class="product-price">
              ₹${product.price.toFixed(2)}
              <small>/ ${escapeHTML(product.unit)}</small>
            </p>

            <button
              class="add-button"
              data-add="${escapeHTML(product.id)}"
              type="button"
            >
              + Add
            </button>
          </div>

          <a
            class="view-details-button"
            href="/product-details.html?id=${encodeURIComponent(product.id)}"
          >
            🌿 View Details
          </a>
        </div>
      </article>
    `;
  }).join("");
}

// Add a product to the cart.
function addToCart(productId) {
  const product = products.find(item => item.id === productId);

  if (!product) {
    alert("This product is no longer available.");
    return;
  }

  const item = cart.find(entry => entry.id === productId);

  if (item) {
    if (item.quantity >= 99) {
      alert("Maximum quantity is 99 per product.");
      return;
    }

    item.quantity += 1;
  } else {
    cart.push({
      id: productId,
      quantity: 1
    });
  }

  saveCart();
  renderCart();
}

// Change product quantity in the cart.
function changeQuantity(productId, amount) {
  const item = cart.find(entry => entry.id === productId);

  if (!item) return;

  item.quantity += amount;

  if (item.quantity <= 0) {
    cart = cart.filter(entry => entry.id !== productId);
  } else if (item.quantity > 99) {
    item.quantity = 99;
  }

  saveCart();
  renderCart();
}

// Remove a product from the cart.
function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  renderCart();
}

// Display cart items and subtotal.
function renderCart() {
  const cartItems = document.getElementById("cart-items");

  const count = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const subtotal = cart.reduce((sum, item) => {
    const product = products.find(p => p.id === item.id);

    return sum + (
      product ? product.price * item.quantity : 0
    );
  }, 0);

  document.getElementById("cart-count").textContent = count;

  document.getElementById("cart-subtotal").textContent =
    `₹${subtotal.toFixed(2)}`;

  document.getElementById("checkout-button").disabled =
    count === 0;

  if (cart.length === 0) {
    cartItems.innerHTML = `
      <p class="cart-empty">
        🧺 Your cart is empty.<br>
        Add some fresh produce to get started!
      </p>
    `;
    return;
  }

  cartItems.innerHTML = cart.map(item => {
    const product = products.find(p => p.id === item.id);

    if (!product) return "";

    return `
      <div class="cart-item">
        <span class="cart-item-emoji">
          ${escapeHTML(product.emoji)}
        </span>

        <div>
          <h3>${escapeHTML(product.name)}</h3>

          <small>
            ₹${product.price.toFixed(2)} /
            ${escapeHTML(product.unit)}
          </small>

          <div class="quantity-controls">
            <button
              type="button"
              data-change="${escapeHTML(product.id)}"
              data-amount="-1"
              aria-label="Decrease ${escapeHTML(product.name)} quantity"
            >−</button>

            <span>${item.quantity}</span>

            <button
              type="button"
              data-change="${escapeHTML(product.id)}"
              data-amount="1"
              aria-label="Increase ${escapeHTML(product.name)} quantity"
            >+</button>
          </div>
        </div>

        <div>
          <strong>
            ₹${(product.price * item.quantity).toFixed(2)}
          </strong>
          <br>

          <button
            type="button"
            class="remove-button"
            data-remove="${escapeHTML(product.id)}"
          >
            Remove
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// Open and close cart.
function openCart() {
  document.getElementById("cart-panel").hidden = false;
  document.getElementById("overlay").hidden = false;
  document.body.classList.add("cart-open");
  document.getElementById("close-cart").focus();
}

function closeCart() {
  document.getElementById("cart-panel").hidden = true;
  document.getElementById("overlay").hidden = true;
  document.body.classList.remove("cart-open");
  document.getElementById("cart-button").focus();
}

// Product Add buttons.
document.getElementById("product-grid").addEventListener(
  "click",
  event => {
    const button = event.target.closest("[data-add]");

    if (button) {
      addToCart(button.dataset.add);
    }
  }
);

// Cart quantity and remove buttons.
document.getElementById("cart-items").addEventListener(
  "click",
  event => {
    const quantityButton = event.target.closest("[data-change]");
    const removeButton = event.target.closest("[data-remove]");

    if (quantityButton) {
      changeQuantity(
        quantityButton.dataset.change,
        Number(quantityButton.dataset.amount)
      );
    }

    if (removeButton) {
      removeFromCart(removeButton.dataset.remove);
    }
  }
);

// Search products.
document.getElementById("search-input").addEventListener(
  "input",
  renderProducts
);

// Filter categories.
document.getElementById("category-filters").addEventListener(
  "click",
  event => {
    const button = event.target.closest("[data-category]");

    if (!button) return;

    selectedCategory = button.dataset.category;

    document.querySelectorAll(".filter").forEach(filter => {
      filter.classList.toggle("active", filter === button);
    });

    renderProducts();
  }
);

// Cart controls.
document.getElementById("cart-button").addEventListener(
  "click",
  openCart
);

document.getElementById("close-cart").addEventListener(
  "click",
  closeCart
);

document.getElementById("overlay").addEventListener(
  "click",
  closeCart
);

document.addEventListener("keydown", event => {
  if (
    event.key === "Escape" &&
    !document.getElementById("cart-panel").hidden
  ) {
    closeCart();
  }
});

// Checkout elements.
const checkoutContainer = document.getElementById(
  "checkout-form-container"
);

const checkoutForm = document.getElementById("checkout-form");

const checkoutMessage = document.getElementById(
  "checkout-message"
);

const placeOrderButton = document.getElementById(
  "place-order-button"
);

const cancelCheckoutButton = document.getElementById(
  "cancel-checkout-button"
);

// Open checkout.
function openCheckout() {
  const user = getSavedUser();
  const token = localStorage.getItem("agrocartToken");

  if (!token || !user || user.role !== "customer") {
    document.getElementById("cart-message").textContent =
      "Please log in with your customer account before checkout.";

    document.getElementById("customer-access").scrollIntoView({
      behavior: "smooth"
    });

    return;
  }

  if (cart.length === 0) {
    document.getElementById("cart-message").textContent =
      "Your cart is empty. Add products before checkout.";
    return;
  }

  checkoutMessage.textContent = "";
  checkoutContainer.hidden = false;
  document.getElementById("cart-items").hidden = true;
  document.getElementById("checkout-button").hidden = true;

  checkoutContainer.scrollIntoView({ behavior: "smooth" });
}

// Close checkout.
function closeCheckout() {
  checkoutContainer.hidden = true;
  document.getElementById("cart-items").hidden = false;
  document.getElementById("checkout-button").hidden = false;
  checkoutMessage.textContent = "";
}

document.getElementById("checkout-button").textContent =
  "Proceed to Checkout";

document.getElementById("checkout-button").addEventListener(
  "click",
  openCheckout
);

cancelCheckoutButton.addEventListener(
  "click",
  closeCheckout
);

// Place order.
checkoutForm.addEventListener("submit", async event => {
  event.preventDefault();

  const token = localStorage.getItem("agrocartToken");
  const user = getSavedUser();

  if (!token || !user || user.role !== "customer") {
    checkoutMessage.textContent =
      "Please log in with your customer account again.";
    return;
  }

  if (cart.length === 0) {
    checkoutMessage.textContent =
      "Your cart is empty. Please add products first.";
    return;
  }

  placeOrderButton.disabled = true;
  checkoutMessage.textContent = "Placing your order...";

  try {
    const deliveryAddress = {
      fullName: document.getElementById("delivery-name").value.trim(),
      phone: document.getElementById("delivery-phone").value.trim(),
      addressLine: document.getElementById("delivery-address").value.trim(),
      city: document.getElementById("delivery-city").value.trim(),
      state: document.getElementById("delivery-state").value.trim(),
      pincode: document.getElementById("delivery-pincode").value.trim(),
      instructions: document.getElementById("delivery-instructions").value.trim()
    };

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        items: cart.map(item => ({
          productId: item.id,
          quantity: item.quantity
        })),
        deliveryAddress,
        paymentMethod: "Cash on Delivery"
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to place your order.");
    }

    cart = [];
    saveCart();
    renderCart();

    checkoutForm.reset();
    checkoutContainer.hidden = true;
    document.getElementById("cart-items").hidden = false;
    document.getElementById("checkout-button").hidden = false;
    checkoutMessage.textContent = "";

    const orderNumber = document.createElement("p");

    const orderId =
      data.order?.id || data.order?._id || "confirmed";

    const orderTotal = Number(data.order?.totalAmount);

    orderNumber.textContent =
      `Order placed successfully! Order ID: ${orderId}. ` +
      `Total: ₹${Number.isFinite(orderTotal) ? orderTotal.toFixed(2) : "0.00"}. ` +
      "Payment: Cash on Delivery.";

    orderNumber.setAttribute("role", "status");

    document.getElementById("cart-message").replaceChildren(
      orderNumber
    );
  } catch (error) {
    checkoutMessage.textContent = error.message;
  } finally {
    placeOrderButton.disabled = false;
  }
});

// Footer year.
document.getElementById("year").textContent =
  new Date().getFullYear();

// Farmer login and registration.
const farmerAuthForm = document.getElementById("farmer-auth-form");

if (farmerAuthForm) {
  const mode = document.getElementById("farmer-auth-mode");
  const nameField = document.getElementById("farmer-name-field");
  const nameInput = document.getElementById("farmer-auth-name");
  const emailInput = document.getElementById("farmer-auth-email");
  const passwordInput = document.getElementById("farmer-auth-password");
  const submitButton = document.getElementById("farmer-auth-submit");
  const authMessage = document.getElementById("farmer-auth-message");
  const dashboardButton = document.getElementById("farmer-dashboard-link");

  function updateFarmerAuthMode() {
    const registering = mode.value === "register";

    nameField.hidden = !registering;
    nameInput.required = registering;

    passwordInput.autocomplete = registering
      ? "new-password"
      : "current-password";

    submitButton.textContent = registering
      ? "Create Farmer Account"
      : "Log In";

    authMessage.textContent = "";
  }

  mode.addEventListener("change", updateFarmerAuthMode);

  dashboardButton.addEventListener("click", () => {
    window.location.href = "/farmer-dashboard.html";
  });

  updateFarmerAuthMode();

  farmerAuthForm.addEventListener("submit", async event => {
    event.preventDefault();

    submitButton.disabled = true;
    dashboardButton.hidden = true;
    authMessage.textContent = "Please wait...";
    authMessage.style.color = "#245b35";

    try {
      const registering = mode.value === "register";

      const payload = {
        email: emailInput.value.trim(),
        password: passwordInput.value
      };

      if (registering) {
        payload.name = nameInput.value.trim();
        payload.role = "farmer";
      }

      const endpoint = registering
        ? "/api/auth/register"
        : "/api/auth/login";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Authentication failed.");
      }

      if (registering) {
        mode.value = "login";
        passwordInput.value = "";
        updateFarmerAuthMode();

        authMessage.textContent =
          "Account created! Please log in using your new account.";
        return;
      }

      if (!data.user || data.user.role !== "farmer") {
        throw new Error(
          "This account is not a farmer account. Please use a farmer account."
        );
      }

      localStorage.setItem("agrocartToken", data.token);
      localStorage.setItem(
        "agrocartUser",
        JSON.stringify(data.user)
      );

      authMessage.textContent =
        `Login successful! Welcome, ${data.user.name} 🌱`;

      authMessage.style.color = "#20632f";

      dashboardButton.hidden = false;
      dashboardButton.focus();
    } catch (error) {
      authMessage.textContent = error.message;
      authMessage.style.color = "#a52828";
    } finally {
      submitButton.disabled = false;
    }
  });
}

// Customer login and registration.
const customerAuthForm = document.getElementById("customer-auth-form");

if (customerAuthForm) {
  const mode = document.getElementById("customer-auth-mode");
  const nameField = document.getElementById("customer-name-field");
  const nameInput = document.getElementById("customer-auth-name");
  const emailInput = document.getElementById("customer-auth-email");
  const passwordInput = document.getElementById("customer-auth-password");
  const submitButton = document.getElementById("customer-auth-submit");
  const message = document.getElementById("customer-auth-message");
  const shopButton = document.getElementById("customer-shop-link");

  function updateCustomerAuthMode() {
    const registering = mode.value === "register";

    nameField.hidden = !registering;
    nameInput.required = registering;

    passwordInput.autocomplete = registering
      ? "new-password"
      : "current-password";

    submitButton.textContent = registering
      ? "Create Customer Account"
      : "Log In";

    message.textContent = "";
    shopButton.hidden = true;
  }

  mode.addEventListener("change", updateCustomerAuthMode);

  shopButton.addEventListener("click", () => {
    document.getElementById("products").scrollIntoView({
      behavior: "smooth"
    });
  });

  customerAuthForm.addEventListener("submit", async event => {
    event.preventDefault();

    submitButton.disabled = true;
    shopButton.hidden = true;
    message.textContent = "Please wait...";

    try {
      const registering = mode.value === "register";

      const payload = {
        email: emailInput.value.trim(),
        password: passwordInput.value
      };

      let endpoint = "/api/auth/login";

      if (registering) {
        endpoint = "/api/auth/register";
        payload.name = nameInput.value.trim();
        payload.role = "customer";
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Authentication failed.");
      }

      if (registering) {
        mode.value = "login";
        passwordInput.value = "";
        updateCustomerAuthMode();

        message.textContent =
          "Account created! Please log in using your new account.";
        return;
      }

      if (!data.user || data.user.role !== "customer") {
        throw new Error(
          "This is not a customer account. Please use the correct portal."
        );
      }

      localStorage.setItem("agrocartToken", data.token);
      localStorage.setItem(
        "agrocartUser",
        JSON.stringify(data.user)
      );

      message.textContent =
        `Welcome, ${data.user.name}! You can now start shopping.`;

      shopButton.hidden = false;
      shopButton.focus();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });

  updateCustomerAuthMode();
}

// Start the website.
fetchProducts();