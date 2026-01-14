# Wix UCP Integration

## Universal Commerce Protocol Implementation for AI-Powered Shopping

---

## 🎯 What is UCP?

**Universal Commerce Protocol (UCP)** is a standardized protocol that enables:

- 🤖 **AI agents** to interact with e-commerce platforms
- 🛒 **Unified shopping experiences** across different stores
- 🔗 **Seamless integration** between AI assistants and merchants

Think of it as a universal language that lets any AI assistant shop on any UCP-enabled store.

---

## 🏗️ What We Built

A **complete UCP integration layer** for Wix e-commerce that enables:

| Capability | Description |
|------------|-------------|
| **Discovery** | Auto-discoverable merchant profile |
| **Checkout** | Full cart → checkout → payment flow |
| **Identity** | OAuth 2.0 identity linking |
| **Orders** | Order history, tracking, returns |
| **Payments** | Secure tokenization & processing |
| **MCP Bridge** | AI agent interaction layer |

---

## 🔧 Architecture

```
┌─────────────────────────────────────────────────────┐
│                    AI Agents                        │
│              (Claude, GPT, etc.)                    │
└──────────────────────┬──────────────────────────────┘
                       │ MCP Protocol
                       ▼
┌─────────────────────────────────────────────────────┐
│              Wix UCP Integration                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Discovery│ │ Checkout │ │  Orders  │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Identity │ │ Payments │ │MCP Bridge│            │
│  └──────────┘ └──────────┘ └──────────┘            │
└──────────────────────┬──────────────────────────────┘
                       │ Wix APIs
                       ▼
┌─────────────────────────────────────────────────────┐
│                  Wix Platform                       │
│         (eCommerce, Payments, Members)              │
└─────────────────────────────────────────────────────┘
```

---

## 🌐 Live URLs

### Production Endpoints

| Endpoint | URL |
|----------|-----|
| **API Base** | https://wix-ucp-api.onrender.com |
| **Discovery Profile** | https://wix-ucp-api.onrender.com/.well-known/ucp/profile |
| **Health Check** | https://wix-ucp-api.onrender.com/health |
| **API Docs** | https://wix-ucp-api.onrender.com/docs |

### Test UI

| Tool | URL | Use For |
|------|-----|---------|
| **MCP Console** | [/test-ui/console](https://wix-ucp-api.onrender.com/test-ui/console) | Testing individual API tools |
| **Flow Wizard** | [/test-ui/wizard](https://wix-ucp-api.onrender.com/test-ui/wizard) | Step-by-step checkout demo |

---

## 🔄 Demo Mode vs Live Mode

The Test UI supports **instant switching** between demo and live data:

| Mode | Indicator | Data Source |
|------|-----------|-------------|
| **🟢 Live** | Green badge | Real Wix store data |
| **🟡 Demo** | Yellow badge | Mock data (no Wix needed) |
| **🔄 Server Default** | Gray badge | Uses DEMO_MODE env var |

### Quick Test URLs

| Scenario | URL | Description |
|----------|-----|-------------|
| **Console - Live Data** | [/test-ui/console?mode=live](https://wix-ucp-api.onrender.com/test-ui/console?mode=live) | 🟢 Real Wix store products |
| **Console - Demo Data** | [/test-ui/console?mode=demo](https://wix-ucp-api.onrender.com/test-ui/console?mode=demo) | 🟡 Mock products (no Wix needed) |
| **Wizard - Live Flow** | [/test-ui/wizard](https://wix-ucp-api.onrender.com/test-ui/wizard) | Server default checkout flow |
| **Wizard - Demo Flow** | [/test-ui/wizard](https://wix-ucp-api.onrender.com/test-ui/wizard) | Server default checkout flow |

---

## 🎮 How to Use: MCP Test Console

**URL:** https://wix-ucp-api.onrender.com/test-ui/console

### Features:
1. **Mode Toggle** - Switch between Live/Demo/Server Default instantly
2. **Select any MCP tool** from the dropdown (16 tools available)
3. **Edit JSON arguments** in the editor
4. **Click Execute** to run the tool
5. **View response** with syntax highlighting
6. **Browse history** of all requests

### Quick Start (Demo Mode):
1. Select **"🟡 Demo (Mock Data)"** from Mode dropdown
2. Select `searchProducts` from tool dropdown
3. Set arguments: `{"query": "headphones"}`
4. Click **▶ Execute Tool**
5. See mock product results!

### Quick Start (Live Mode):
1. Select **"🟢 Live (Real Wix)"** from Mode dropdown
2. Select `searchProducts` from tool dropdown
3. Set arguments: `{"query": ""}`
4. Click **▶ Execute Tool**
5. See **real products** from your Wix store!

---

## 🛒 How to Use: Flow Wizard

**URL:** https://wix-ucp-api.onrender.com/test-ui/wizard

### 6-Step Checkout Flow:

| Step | Action |
|------|--------|
| **1. Products** | Search and select a product |
| **2. Cart** | View cart with selected item |
| **3. Checkout** | Enter buyer email & name |
| **4. Shipping** | Enter address, select shipping |
| **5. Payment** | Review order, complete payment |
| **6. Complete** | See confirmation & order ID |

### Features:
- 📊 **API Activity** sidebar shows all calls in real-time
- ⬅️ **Back buttons** to navigate between steps
- 🔄 **Reset Flow** to start over
- 🔗 **Link to Console** for advanced testing

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js + TypeScript |
| **Framework** | Fastify |
| **Database** | PostgreSQL (Prisma ORM) |
| **Cache** | Redis |
| **Validation** | Zod |
| **Auth** | JWT (jose) |
| **Hosting** | Render |
| **Testing** | Vitest (493+ tests) |

---

## 📋 MCP Tools Reference

### Profile & Discovery
- `getBusinessProfile` - Get merchant info

### Catalog
- `searchProducts` - Search product catalog
- `getProduct` - Get product details

### Checkout
- `createCart` - Create shopping cart
- `addToCart` - Add item to cart
- `createCheckout` - Start checkout
- `updateCheckout` - Update checkout info
- `getShippingOptions` - Get shipping methods
- `completeCheckout` - Complete purchase

### Orders
- `getOrder` - Get order by ID
- `listOrders` - List order history
- `getOrderTracking` - Get tracking info

### Identity
- `createVisitorSession` - Create visitor
- `linkIdentity` - Link user account
- `getMemberInfo` - Get member profile

---

## 🔒 Security Features

- ✅ JWT-based authentication
- ✅ Input validation (Zod schemas)
- ✅ Rate limiting
- ✅ Secure headers (Helmet)
- ✅ Token encryption
- ✅ Audit logging

---

## 📈 Test Coverage

```
✓ 493+ tests passing
✓ All modules covered
✓ Unit + Integration tests
✓ Demo mode for isolated testing
✓ Live mode for real Wix data
✓ Per-request mode switching
```

---

## ✅ Completed

1. ✅ **Connected to real Wix store** - Live API credentials configured
2. ✅ **Deployed to production** - Running on Render
3. ✅ **Mode switching** - Demo/Live toggle in UI
4. ✅ **Full test coverage** - 493+ tests passing

## 🚀 Next Steps

1. **Integrate with AI agent** - Connect to Claude/GPT via MCP
2. **Customize branding** - Update merchant profile
3. **Add webhooks** - Real-time order notifications
4. **Multi-store support** - Connect additional Wix stores

---

## 📚 Resources

- **GitHub:** https://github.com/itayshmool/wix-ucp
- **API Docs:** https://wix-ucp-api.onrender.com/docs
- **UCP Spec:** https://ucp.dev

---

## 🙏 Thank You!

**Questions?** Try the live demo:

👉 [MCP Console](https://wix-ucp-api.onrender.com/test-ui/console) | [Flow Wizard](https://wix-ucp-api.onrender.com/test-ui/wizard)
