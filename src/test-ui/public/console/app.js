/**
 * Wix UCP Test Console - Application Logic
 * Interactive MCP tool testing interface
 */

// ============================================
// Configuration
// ============================================
const API_BASE = window.location.origin;
const TEST_API_ENDPOINT = `${API_BASE}/test-ui/api`;

// ============================================
// Tool Definitions
// ============================================
const TOOL_DEFINITIONS = {
  // Discovery
  getBusinessProfile: {
    description: 'Get the business profile and UCP capabilities. Returns supported features, payment handlers, and business information.',
    defaultArgs: {},
    category: 'Discovery'
  },
  
  // Products
  searchProducts: {
    description: 'Search for products in the catalog by query, category, price range, or other filters.',
    defaultArgs: { query: '', limit: 5 },
    category: 'Products'
  },
  getProductDetails: {
    description: 'Get detailed information about a specific product including variants, images, and availability.',
    defaultArgs: { productId: 'prod_001' },
    category: 'Products'
  },
  
  // Cart
  createCart: {
    description: 'Create a new shopping cart. Returns a cart ID for subsequent operations.',
    defaultArgs: {},
    category: 'Cart'
  },
  getCart: {
    description: 'Retrieve the current cart contents, including line items and totals.',
    defaultArgs: { cartId: '' },
    category: 'Cart'
  },
  addToCart: {
    description: 'Add a product to the cart with specified quantity and options.',
    defaultArgs: { 
      cartId: '', 
      productId: 'prod_001', 
      quantity: 1,
      options: {}
    },
    category: 'Cart'
  },
  updateCartItem: {
    description: 'Update the quantity or options of an item already in the cart.',
    defaultArgs: { 
      cartId: '', 
      lineItemId: '', 
      quantity: 2 
    },
    category: 'Cart'
  },
  removeFromCart: {
    description: 'Remove an item from the cart by its line item ID.',
    defaultArgs: { 
      cartId: '', 
      lineItemId: '' 
    },
    category: 'Cart'
  },
  
  // Checkout
  createCheckout: {
    description: 'Create a checkout session from a cart. This starts the checkout flow.',
    defaultArgs: { 
      cartId: '',
      buyer: {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      }
    },
    category: 'Checkout'
  },
  updateCheckout: {
    description: 'Update checkout with shipping address, billing address, or other details.',
    defaultArgs: { 
      checkoutId: '',
      shippingAddress: {
        line1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94102',
        country: 'US'
      }
    },
    category: 'Checkout'
  },
  getShippingOptions: {
    description: 'Get available shipping options for the checkout based on the shipping address.',
    defaultArgs: { checkoutId: '' },
    category: 'Checkout'
  },
  completeCheckout: {
    description: 'Complete the checkout with payment information. Creates an order on success.',
    defaultArgs: { 
      checkoutId: '',
      paymentToken: '',
      shippingOptionId: ''
    },
    category: 'Checkout'
  },
  
  // Orders
  getOrder: {
    description: 'Get details of a specific order by ID, including status and tracking info.',
    defaultArgs: { orderId: 'order_001' },
    category: 'Orders'
  },
  listOrders: {
    description: 'List orders for the authenticated user with optional filtering and pagination.',
    defaultArgs: { 
      limit: 10,
      status: ''
    },
    category: 'Orders'
  },
  
  // Identity
  linkIdentity: {
    description: 'Start the OAuth flow to link a customer identity for personalized experiences.',
    defaultArgs: { 
      redirectUri: window.location.origin + '/identity/callback',
      scopes: ['profile', 'orders']
    },
    category: 'Identity'
  }
};

// Quick examples
const QUICK_EXAMPLES = {
  search: {
    tool: 'searchProducts',
    args: { query: 'wireless', limit: 5, minPrice: 10, maxPrice: 500 }
  },
  cart: {
    tool: 'createCart',
    args: {}
  },
  checkout: {
    tool: 'createCheckout',
    args: {
      cartId: 'cart_xxx',
      buyer: {
        email: 'customer@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1-555-123-4567'
      }
    }
  }
};

// ============================================
// State
// ============================================
let state = {
  sessionId: null,
  history: [],
  lastResponse: null,
  mode: null // 'demo', 'live', or null (use server default)
};

// ============================================
// DOM Elements
// ============================================
const elements = {
  sessionId: document.getElementById('sessionId'),
  newSessionBtn: document.getElementById('newSessionBtn'),
  clearBtn: document.getElementById('clearBtn'),
  modeSelect: document.getElementById('modeSelect'),
  toolSelect: document.getElementById('toolSelect'),
  toolDescription: document.getElementById('toolDescription'),
  argsInput: document.getElementById('argsInput'),
  formatJsonBtn: document.getElementById('formatJsonBtn'),
  executeBtn: document.getElementById('executeBtn'),
  responseStatus: document.getElementById('responseStatus'),
  responseTime: document.getElementById('responseTime'),
  responseOutput: document.getElementById('responseOutput'),
  copyResponseBtn: document.getElementById('copyResponseBtn'),
  historyList: document.getElementById('historyList'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  loadingOverlay: document.getElementById('loadingOverlay')
};

// ============================================
// Session Management
// ============================================
async function initSession() {
  try {
    const response = await fetch(`${TEST_API_ENDPOINT}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      const data = await response.json();
      state.sessionId = data.sessionId;
      elements.sessionId.textContent = state.sessionId.substring(0, 16) + '...';
      localStorage.setItem('mcpSessionId', state.sessionId);
    } else {
      // Session endpoint might not exist, generate client-side ID
      state.sessionId = 'mcp_' + generateId();
      elements.sessionId.textContent = state.sessionId.substring(0, 16) + '...';
    }
  } catch (error) {
    // Fallback to client-side session
    state.sessionId = 'mcp_' + generateId();
    elements.sessionId.textContent = state.sessionId.substring(0, 16) + '...';
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// ============================================
// Tool Execution
// ============================================
async function executeTool() {
  const toolName = elements.toolSelect.value;
  let args;
  
  // Parse arguments
  try {
    const argsText = elements.argsInput.value.trim();
    args = argsText ? JSON.parse(argsText) : {};
  } catch (error) {
    showError('Invalid JSON in arguments: ' + error.message);
    return;
  }
  
  // Show loading
  showLoading(true);
  updateStatus('loading', `Executing ${toolName}...`);
  
  const startTime = performance.now();
  
  try {
    // Try test UI API endpoint first
    const requestBody = {
      tool: toolName,
      arguments: args
    };
    
    // Include mode if explicitly set (not null/server default)
    if (state.mode) {
      requestBody.mode = state.mode;
    }
    
    const response = await fetch(`${TEST_API_ENDPOINT}/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': state.sessionId || ''
      },
      body: JSON.stringify(requestBody)
    });
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = { raw: await response.text() };
    }
    
    if (response.ok) {
      showSuccess(data, duration);
      addToHistory(toolName, args, data, duration, true);
    } else {
      showError(data, duration);
      addToHistory(toolName, args, data, duration, false);
    }
  } catch (error) {
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    // Try fallback to direct API calls
    try {
      const fallbackResult = await executeDirectApi(toolName, args);
      showSuccess(fallbackResult, duration);
      addToHistory(toolName, args, fallbackResult, duration, true);
    } catch (fallbackError) {
      const errorData = { error: error.message, fallbackError: fallbackError.message };
      showError(errorData, duration);
      addToHistory(toolName, args, errorData, duration, false);
    }
  } finally {
    showLoading(false);
  }
}

// Direct API fallback for when MCP endpoint isn't available
async function executeDirectApi(toolName, args) {
  const apiMappings = {
    getBusinessProfile: { method: 'GET', path: '/.well-known/ucp' },
    searchProducts: { method: 'POST', path: '/ucp/v1/products/search', body: args },
    getProductDetails: { method: 'GET', path: `/ucp/v1/products/${args.productId}` },
    createCart: { method: 'POST', path: '/ucp/v1/carts', body: args },
    getCart: { method: 'GET', path: `/ucp/v1/carts/${args.cartId}` },
    addToCart: { method: 'POST', path: `/ucp/v1/carts/${args.cartId}/items`, body: args },
    createCheckout: { method: 'POST', path: '/ucp/v1/checkout-sessions', body: args },
    updateCheckout: { method: 'PATCH', path: `/ucp/v1/checkout-sessions/${args.checkoutId}`, body: args },
    getShippingOptions: { method: 'GET', path: `/ucp/v1/checkout-sessions/${args.checkoutId}/fulfillment-options` },
    completeCheckout: { method: 'POST', path: `/ucp/v1/checkout-sessions/${args.checkoutId}/complete`, body: args },
    getOrder: { method: 'GET', path: `/ucp/v1/orders/${args.orderId}` },
    listOrders: { method: 'GET', path: '/ucp/v1/orders' }
  };
  
  const mapping = apiMappings[toolName];
  if (!mapping) {
    throw new Error(`No direct API mapping for tool: ${toolName}`);
  }
  
  const options = {
    method: mapping.method,
    headers: { 'Content-Type': 'application/json' }
  };
  
  if (mapping.body && ['POST', 'PATCH', 'PUT'].includes(mapping.method)) {
    options.body = JSON.stringify(mapping.body);
  }
  
  const response = await fetch(`${API_BASE}${mapping.path}`, options);
  return await response.json();
}

// ============================================
// UI Updates
// ============================================
function updateStatus(type, message) {
  elements.responseStatus.className = `response-status ${type}`;
  const iconMap = { loading: '◐', success: '●', error: '✕', ready: '○' };
  elements.responseStatus.innerHTML = `
    <span class="status-icon">${iconMap[type] || '○'}</span>
    <span class="status-text">${message}</span>
  `;
}

function showSuccess(data, duration) {
  state.lastResponse = data;
  updateStatus('success', 'Success');
  elements.responseTime.textContent = `${duration}ms`;
  elements.responseOutput.innerHTML = formatJson(data);
}

function showError(data, duration = 0) {
  state.lastResponse = data;
  updateStatus('error', 'Error');
  if (duration) elements.responseTime.textContent = `${duration}ms`;
  elements.responseOutput.innerHTML = formatJson(data);
}

function showLoading(show) {
  elements.loadingOverlay.classList.toggle('active', show);
  elements.executeBtn.disabled = show;
}

function formatJson(obj) {
  try {
    const json = JSON.stringify(obj, null, 2);
    // Syntax highlighting
    return json
      .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
      .replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>')
      .replace(/: (\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
      .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
      .replace(/: (null)/g, ': <span class="json-null">$1</span>');
  } catch (e) {
    return String(obj);
  }
}

function updateToolDescription() {
  const toolName = elements.toolSelect.value;
  const tool = TOOL_DEFINITIONS[toolName];
  if (tool) {
    elements.toolDescription.innerHTML = `<p>${tool.description}</p>`;
    elements.argsInput.value = JSON.stringify(tool.defaultArgs, null, 2);
  }
}

// ============================================
// History Management
// ============================================
function addToHistory(tool, args, response, duration, success) {
  const entry = {
    id: generateId(),
    tool,
    args,
    response,
    duration,
    success,
    timestamp: new Date()
  };
  
  state.history.unshift(entry);
  
  // Keep only last 20 entries
  if (state.history.length > 20) {
    state.history.pop();
  }
  
  renderHistory();
  saveState();
}

function renderHistory() {
  if (state.history.length === 0) {
    elements.historyList.innerHTML = '<div class="history-empty">No requests yet. Execute a tool to see history.</div>';
    return;
  }
  
  elements.historyList.innerHTML = state.history.map(entry => `
    <div class="history-item ${entry.success ? 'success' : 'error'}" data-id="${entry.id}">
      <span class="history-tool">${entry.tool}</span>
      <span class="history-time">${formatTime(entry.timestamp)}</span>
      <span class="history-duration">${entry.duration}ms</span>
    </div>
  `).join('');
  
  // Add click handlers
  elements.historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const entry = state.history.find(h => h.id === item.dataset.id);
      if (entry) {
        elements.toolSelect.value = entry.tool;
        elements.argsInput.value = JSON.stringify(entry.args, null, 2);
        elements.responseOutput.innerHTML = formatJson(entry.response);
        updateStatus(entry.success ? 'success' : 'error', entry.success ? 'Success' : 'Error');
        elements.responseTime.textContent = `${entry.duration}ms`;
        updateToolDescription();
      }
    });
  });
}

function formatTime(date) {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function clearHistory() {
  state.history = [];
  renderHistory();
  saveState();
}

// ============================================
// State Persistence
// ============================================
function saveState() {
  try {
    localStorage.setItem('ucpConsoleState', JSON.stringify({
      sessionId: state.sessionId,
      history: state.history.slice(0, 10), // Only save last 10
      mode: state.mode
    }));
  } catch (e) {
    console.warn('Could not save state:', e);
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem('ucpConsoleState');
    if (saved) {
      const parsed = JSON.parse(saved);
      state.sessionId = parsed.sessionId;
      state.history = parsed.history || [];
      state.mode = parsed.mode || null;
    }
  } catch (e) {
    console.warn('Could not load state:', e);
  }
}

// ============================================
// Event Handlers
// ============================================
function setupEventListeners() {
  // Execute tool
  elements.executeBtn.addEventListener('click', executeTool);
  
  // Tool selection change
  elements.toolSelect.addEventListener('change', updateToolDescription);
  
  // Mode toggle
  elements.modeSelect.addEventListener('change', () => {
    const selectedMode = elements.modeSelect.value;
    state.mode = selectedMode || null; // null = use server default
    saveState();
    updateUrlWithMode(state.mode);
    console.log(`Mode changed to: ${state.mode || 'server default'}`);
  });
  
  // New session
  elements.newSessionBtn.addEventListener('click', () => {
    state.sessionId = null;
    localStorage.removeItem('mcpSessionId');
    initSession();
  });
  
  // Clear output
  elements.clearBtn.addEventListener('click', () => {
    elements.responseOutput.innerHTML = '<code>// Response cleared</code>';
    elements.responseTime.textContent = '';
    updateStatus('ready', 'Ready to execute');
    state.lastResponse = null;
  });
  
  // Format JSON
  elements.formatJsonBtn.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(elements.argsInput.value);
      elements.argsInput.value = JSON.stringify(parsed, null, 2);
    } catch (e) {
      // Already invalid, can't format
    }
  });
  
  // Copy response
  elements.copyResponseBtn.addEventListener('click', async () => {
    if (state.lastResponse) {
      try {
        await navigator.clipboard.writeText(JSON.stringify(state.lastResponse, null, 2));
        elements.copyResponseBtn.textContent = 'Copied!';
        setTimeout(() => {
          elements.copyResponseBtn.textContent = 'Copy';
        }, 2000);
      } catch (e) {
        console.error('Failed to copy:', e);
      }
    }
  });
  
  // Clear history
  elements.clearHistoryBtn.addEventListener('click', clearHistory);
  
  // Quick examples
  document.querySelectorAll('[data-example]').forEach(btn => {
    btn.addEventListener('click', () => {
      const example = QUICK_EXAMPLES[btn.dataset.example];
      if (example) {
        elements.toolSelect.value = example.tool;
        elements.argsInput.value = JSON.stringify(example.args, null, 2);
        updateToolDescription();
      }
    });
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to execute
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeTool();
    }
    
    // Ctrl/Cmd + Shift + F to format JSON
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      elements.formatJsonBtn.click();
    }
  });
}

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

function updateUrlWithMode(mode) {
  const url = new URL(window.location);
  if (mode) {
    url.searchParams.set('mode', mode);
  } else {
    url.searchParams.delete('mode');
  }
  window.history.replaceState({}, '', url);
}

// ============================================
// Initialize
// ============================================
async function init() {
  loadState();
  
  // URL parameter takes precedence over saved state
  const urlMode = getModeFromUrl();
  if (urlMode) {
    state.mode = urlMode;
    saveState();
  }
  
  setupEventListeners();
  
  // Initialize session
  if (state.sessionId) {
    elements.sessionId.textContent = state.sessionId.substring(0, 16) + '...';
  } else {
    await initSession();
  }
  
  // Restore mode selector from state (which may have been set from URL)
  if (state.mode) {
    elements.modeSelect.value = state.mode;
  }
  
  // Sync URL with current mode
  updateUrlWithMode(state.mode);
  
  // Render initial state
  updateToolDescription();
  renderHistory();
  
  console.log('🧪 Wix UCP Test Console initialized');
  console.log('Current mode:', state.mode || 'server default');
  console.log('Keyboard shortcuts:');
  console.log('  Ctrl/Cmd + Enter: Execute tool');
  console.log('  Ctrl/Cmd + Shift + F: Format JSON');
}

// Start the app
init();
