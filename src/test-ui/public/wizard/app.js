/**
 * Wix UCP Flow Wizard - Application Logic
 * Step-by-step checkout flow demonstration
 */

// ============================================
// Configuration
// ============================================
const API_BASE = window.location.origin;
const TEST_API = `${API_BASE}/test-ui/api`;

// ============================================
// State
// ============================================
let state = {
  currentStep: 1,
  selectedProduct: null,
  cart: null,
  checkout: null,
  selectedShipping: null,
  order: null,
  apiLogs: [],
  mode: null // 'demo', 'live', or null (use server default)
};

// ============================================
// URL Parameter Handling
// ============================================
function getModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  if (mode === 'demo' || mode === 'live') {
    return mode;
  }
  return null;
}

// ============================================
// DOM Elements
// ============================================
const elements = {
  progressFill: document.getElementById('progressFill'),
  stepDots: document.querySelectorAll('.step-dot'),
  stepPanels: document.querySelectorAll('.step-panel'),
  resetBtn: document.getElementById('resetBtn'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  loadingText: document.getElementById('loadingText'),
  apiLogContent: document.getElementById('apiLogContent'),
  clearLogBtn: document.getElementById('clearLogBtn'),
  
  // Step 1
  searchInput: document.getElementById('searchInput'),
  searchBtn: document.getElementById('searchBtn'),
  productsGrid: document.getElementById('productsGrid'),
  step1Next: document.getElementById('step1Next'),
  
  // Step 2
  cartSummary: document.getElementById('cartSummary'),
  step2Next: document.getElementById('step2Next'),
  
  // Step 3
  buyerEmail: document.getElementById('buyerEmail'),
  buyerFirstName: document.getElementById('buyerFirstName'),
  buyerLastName: document.getElementById('buyerLastName'),
  checkoutPreview: document.getElementById('checkoutPreview'),
  step3Next: document.getElementById('step3Next'),
  
  // Step 4
  addressLine1: document.getElementById('addressLine1'),
  city: document.getElementById('city'),
  stateField: document.getElementById('state'),
  postalCode: document.getElementById('postalCode'),
  country: document.getElementById('country'),
  shippingOptions: document.getElementById('shippingOptions'),
  step4Next: document.getElementById('step4Next'),
  
  // Step 5
  orderReview: document.getElementById('orderReview'),
  completePaymentBtn: document.getElementById('completePaymentBtn'),
  
  // Step 6
  orderConfirmation: document.getElementById('orderConfirmation'),
  viewOrderBtn: document.getElementById('viewOrderBtn'),
  startOverBtn: document.getElementById('startOverBtn')
};

// ============================================
// API Calls
// ============================================
async function callAPI(tool, args = {}) {
  const startTime = performance.now();
  
  try {
    const requestBody = { tool, arguments: args };
    
    // Include mode if explicitly set (not null/server default)
    if (state.mode) {
      requestBody.mode = state.mode;
    }
    
    const response = await fetch(`${TEST_API}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    const data = await response.json();
    const duration = Math.round(performance.now() - startTime);
    
    addApiLog('POST', `/test-ui/api/call (${tool})`, duration, response.ok);
    
    if (data.success) {
      return data.result;
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    addApiLog('POST', `/test-ui/api/call (${tool})`, 0, false);
    throw error;
  }
}

function addApiLog(method, path, duration, success) {
  const entry = {
    method,
    path,
    duration,
    success,
    time: new Date()
  };
  
  state.apiLogs.unshift(entry);
  renderApiLog();
}

function renderApiLog() {
  if (state.apiLogs.length === 0) {
    elements.apiLogContent.innerHTML = '<div class="log-empty">API calls will appear here as you progress</div>';
    return;
  }
  
  elements.apiLogContent.innerHTML = state.apiLogs.slice(0, 20).map(log => `
    <div class="log-entry ${log.success ? '' : 'error'}">
      <div class="log-method">${log.method}</div>
      <div class="log-path">${log.path}</div>
      <div class="log-time">${log.duration}ms • ${formatTime(log.time)}</div>
    </div>
  `).join('');
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ============================================
// Step Navigation
// ============================================
function goToStep(stepNum) {
  // Update state
  state.currentStep = stepNum;
  
  // Update progress bar
  const progress = ((stepNum - 1) / 5) * 100;
  elements.progressFill.style.width = `${progress}%`;
  
  // Update step dots
  elements.stepDots.forEach((dot, index) => {
    const dotStep = index + 1;
    dot.classList.remove('active', 'completed');
    
    if (dotStep < stepNum) {
      dot.classList.add('completed');
    } else if (dotStep === stepNum) {
      dot.classList.add('active');
    }
  });
  
  // Update step panels
  elements.stepPanels.forEach(panel => {
    panel.classList.remove('active');
    if (parseInt(panel.dataset.step) === stepNum) {
      panel.classList.add('active');
    }
  });
}

// ============================================
// Loading States
// ============================================
function showLoading(text = 'Processing...') {
  elements.loadingText.textContent = text;
  elements.loadingOverlay.classList.add('active');
}

function hideLoading() {
  elements.loadingOverlay.classList.remove('active');
}

// ============================================
// Step 1: Search Products
// ============================================
async function searchProducts() {
  const query = elements.searchInput.value.trim();
  
  showLoading('Searching products...');
  
  try {
    const result = await callAPI('searchProducts', { query, limit: 6 });
    renderProducts(result.products);
  } catch (error) {
    elements.productsGrid.innerHTML = `<div class="loading-placeholder">Error: ${error.message}</div>`;
  } finally {
    hideLoading();
  }
}

function renderProducts(products) {
  if (!products || products.length === 0) {
    elements.productsGrid.innerHTML = '<div class="loading-placeholder">No products found</div>';
    return;
  }
  
  elements.productsGrid.innerHTML = products.map(product => {
    // Handle price format - API returns either string "$X.XX" or object {amount: X}
    let priceDisplay;
    if (typeof product.price === 'string') {
      // Price is already formatted (e.g., "$15.00 (was $15.00)")
      priceDisplay = product.price.split(' ')[0]; // Extract first part "$15.00"
    } else if (product.price?.amount !== undefined) {
      priceDisplay = `$${product.price.amount.toFixed(2)}`;
    } else {
      priceDisplay = 'N/A';
    }
    
    return `
      <div class="product-card" data-id="${product.id}">
        <div class="product-image">
          ${product.images?.[0] ? `<img src="${product.images[0]}" alt="${product.name}">` : '📦'}
        </div>
        <div class="product-name">${product.name}</div>
        <div class="product-price">${priceDisplay}</div>
        <div class="product-stock ${product.inStock ? 'in-stock' : ''}">${product.inStock ? '✓ In Stock' : 'Out of Stock'}</div>
      </div>
    `;
  }).join('');
  
  // Add click handlers
  elements.productsGrid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => selectProduct(card.dataset.id, products));
  });
}

function selectProduct(productId, products) {
  state.selectedProduct = products.find(p => p.id === productId);
  
  // Update UI
  elements.productsGrid.querySelectorAll('.product-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.id === productId);
  });
  
  elements.step1Next.disabled = !state.selectedProduct;
}

async function createCartWithProduct() {
  showLoading('Creating cart...');
  
  try {
    // Create cart
    const cart = await callAPI('createCart', {});
    state.cart = cart;
    
    // Add product to cart
    const updatedCart = await callAPI('addToCart', {
      cartId: cart.id,
      productId: state.selectedProduct.id,
      quantity: 1
    });
    
    state.cart = updatedCart;
    renderCart();
    goToStep(2);
  } catch (error) {
    alert('Error creating cart: ' + error.message);
  } finally {
    hideLoading();
  }
}

// ============================================
// Step 2: Cart Display
// ============================================
function renderCart() {
  const product = state.selectedProduct;
  
  elements.cartSummary.innerHTML = `
    <div class="cart-item">
      <div class="cart-item-image">📦</div>
      <div class="cart-item-details">
        <div class="cart-item-name">${product.name}</div>
        <div class="cart-item-price">$${product.price.amount.toFixed(2)} × 1</div>
      </div>
    </div>
    <div class="cart-total">
      <span>Total</span>
      <span class="cart-total-amount">$${product.price.amount.toFixed(2)}</span>
    </div>
  `;
}

// ============================================
// Step 3: Create Checkout
// ============================================
async function createCheckout() {
  showLoading('Creating checkout...');
  
  try {
    const checkout = await callAPI('createCheckout', {
      cartId: state.cart.id,
      buyer: {
        email: elements.buyerEmail.value,
        firstName: elements.buyerFirstName.value,
        lastName: elements.buyerLastName.value
      }
    });
    
    state.checkout = checkout;
    renderCheckoutPreview();
    goToStep(4);
    loadShippingOptions();
  } catch (error) {
    alert('Error creating checkout: ' + error.message);
  } finally {
    hideLoading();
  }
}

function renderCheckoutPreview() {
  const checkout = state.checkout;
  
  elements.checkoutPreview.innerHTML = `
    <div style="margin-top: var(--space-md); padding: var(--space-md); background: var(--bg-primary); border-radius: var(--radius-md);">
      <div style="color: var(--text-muted); font-size: 0.75rem;">Checkout ID</div>
      <code style="color: var(--accent-primary);">${checkout.id}</code>
    </div>
  `;
}

// ============================================
// Step 4: Shipping
// ============================================
async function loadShippingOptions() {
  showLoading('Loading shipping options...');
  
  try {
    // First update checkout with address
    await callAPI('updateCheckout', {
      checkoutId: state.checkout.id,
      shippingAddress: {
        line1: elements.addressLine1.value,
        city: elements.city.value,
        state: elements.stateField.value,
        postalCode: elements.postalCode.value,
        country: elements.country.value
      }
    });
    
    // Then get shipping options
    const result = await callAPI('getShippingOptions', {
      checkoutId: state.checkout.id
    });
    
    renderShippingOptions(result.options);
  } catch (error) {
    elements.shippingOptions.innerHTML = `<p style="color: var(--status-error);">Error loading shipping options: ${error.message}</p>`;
  } finally {
    hideLoading();
  }
}

function renderShippingOptions(options) {
  elements.shippingOptions.innerHTML = `
    <h4>Select Shipping Method</h4>
    ${options.map((opt, idx) => `
      <div class="shipping-option ${idx === 0 ? 'selected' : ''}" data-id="${opt.id}">
        <div class="shipping-radio"></div>
        <div class="shipping-details">
          <div class="shipping-name">${opt.name}</div>
          <div class="shipping-time">${opt.estimatedDelivery}</div>
        </div>
        <div class="shipping-price">$${opt.price.amount.toFixed(2)}</div>
      </div>
    `).join('')}
  `;
  
  // Select first option by default
  if (options.length > 0) {
    state.selectedShipping = options[0];
  }
  
  // Add click handlers
  elements.shippingOptions.querySelectorAll('.shipping-option').forEach(opt => {
    opt.addEventListener('click', () => {
      elements.shippingOptions.querySelectorAll('.shipping-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      state.selectedShipping = options.find(o => o.id === opt.dataset.id);
    });
  });
}

// ============================================
// Step 5: Order Review & Payment
// ============================================
function renderOrderReview() {
  const product = state.selectedProduct;
  const shipping = state.selectedShipping;
  const subtotal = product.price.amount;
  const shippingCost = shipping?.price?.amount || 0;
  const tax = subtotal * 0.0825; // 8.25% tax
  const total = subtotal + shippingCost + tax;
  
  elements.orderReview.innerHTML = `
    <div class="order-section">
      <h4>Items</h4>
      <div class="order-line">
        <span>${product.name} × 1</span>
        <span class="order-value">$${subtotal.toFixed(2)}</span>
      </div>
    </div>
    
    <div class="order-section">
      <h4>Shipping</h4>
      <div class="order-line">
        <span>${shipping?.name || 'Standard Shipping'}</span>
        <span class="order-value">$${shippingCost.toFixed(2)}</span>
      </div>
      <div class="order-line">
        <span style="color: var(--text-muted);">${elements.addressLine1.value}, ${elements.city.value}</span>
      </div>
    </div>
    
    <div class="order-section">
      <h4>Summary</h4>
      <div class="order-line">
        <span>Subtotal</span>
        <span class="order-value">$${subtotal.toFixed(2)}</span>
      </div>
      <div class="order-line">
        <span>Shipping</span>
        <span class="order-value">$${shippingCost.toFixed(2)}</span>
      </div>
      <div class="order-line">
        <span>Tax</span>
        <span class="order-value">$${tax.toFixed(2)}</span>
      </div>
      <div class="order-line total">
        <span>Total</span>
        <span class="order-value">$${total.toFixed(2)}</span>
      </div>
    </div>
  `;
}

async function completePayment() {
  showLoading('Processing payment...');
  
  try {
    const result = await callAPI('completeCheckout', {
      checkoutId: state.checkout.id,
      paymentToken: 'mock_token_' + Date.now(),
      shippingOptionId: state.selectedShipping?.id || 'ship_standard'
    });
    
    state.order = result;
    renderOrderConfirmation();
    goToStep(6);
  } catch (error) {
    alert('Error completing payment: ' + error.message);
  } finally {
    hideLoading();
  }
}

// ============================================
// Step 6: Order Confirmation
// ============================================
function renderOrderConfirmation() {
  const order = state.order;
  
  elements.orderConfirmation.innerHTML = `
    <p style="color: var(--text-secondary); margin-bottom: var(--space-sm);">Confirmation Number</p>
    <div class="confirmation-number">${order.confirmationNumber}</div>
    <p style="color: var(--text-muted);">Order ID: ${order.orderId}</p>
    <p style="margin-top: var(--space-md);">A confirmation email has been sent to<br><strong>${elements.buyerEmail.value}</strong></p>
  `;
}

async function viewOrderDetails() {
  showLoading('Loading order details...');
  
  try {
    const order = await callAPI('getOrder', { orderId: state.order.orderId });
    
    // Show order details in an alert for simplicity
    alert(`Order Details:\n\nID: ${order.id}\nStatus: ${order.status}\nConfirmation: ${order.confirmationNumber}\n\nCheck the API Log for the full response.`);
  } catch (error) {
    alert('Error loading order: ' + error.message);
  } finally {
    hideLoading();
  }
}

// ============================================
// Reset Flow
// ============================================
function resetFlow() {
  state = {
    currentStep: 1,
    selectedProduct: null,
    cart: null,
    checkout: null,
    selectedShipping: null,
    order: null,
    apiLogs: state.apiLogs // Keep logs
  };
  
  // Reset UI
  elements.productsGrid.innerHTML = '<div class="loading-placeholder">Click "Search" to browse products</div>';
  elements.step1Next.disabled = true;
  elements.cartSummary.innerHTML = '';
  elements.checkoutPreview.innerHTML = '';
  elements.shippingOptions.innerHTML = '';
  elements.orderReview.innerHTML = '';
  elements.orderConfirmation.innerHTML = '';
  
  goToStep(1);
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
  // Search products
  elements.searchBtn.addEventListener('click', searchProducts);
  elements.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchProducts();
  });
  
  // Step 1 -> Step 2
  elements.step1Next.addEventListener('click', createCartWithProduct);
  
  // Step 2 -> Step 3
  elements.step2Next.addEventListener('click', () => goToStep(3));
  
  // Step 3 -> Step 4
  elements.step3Next.addEventListener('click', createCheckout);
  
  // Step 4 -> Step 5
  elements.step4Next.addEventListener('click', () => {
    renderOrderReview();
    goToStep(5);
  });
  
  // Complete payment
  elements.completePaymentBtn.addEventListener('click', completePayment);
  
  // View order
  elements.viewOrderBtn.addEventListener('click', viewOrderDetails);
  
  // Start over
  elements.startOverBtn.addEventListener('click', resetFlow);
  
  // Reset
  elements.resetBtn.addEventListener('click', resetFlow);
  
  // Clear log
  elements.clearLogBtn.addEventListener('click', () => {
    state.apiLogs = [];
    renderApiLog();
  });
  
  // Back buttons
  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => {
      goToStep(parseInt(btn.dataset.goto));
    });
  });
}

// ============================================
// Initialize
// ============================================
function init() {
  // Get mode from URL parameter
  state.mode = getModeFromUrl();
  
  setupEventListeners();
  goToStep(1);
  renderApiLog();
  
  const modeDisplay = state.mode ? `${state.mode.toUpperCase()} mode` : 'server default';
  console.log(`🛒 Wix UCP Flow Wizard initialized (${modeDisplay})`);
}

init();
