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

### Test UI (No Wix Credentials Needed!)

| Tool | URL | Use For |
|------|-----|---------|
| **MCP Console** | [/test-ui/console](https://wix-ucp-api.onrender.com/test-ui/console) | Testing individual API tools |
| **Flow Wizard** | [/test-ui/wizard](https://wix-ucp-api.onrender.com/test-ui/wizard) | Step-by-step checkout demo |

---

## 🎮 How to Use: MCP Test Console

**URL:** https://wix-ucp-api.onrender.com/test-ui/console

### Features:
1. **Select any MCP tool** from the dropdown (16 tools available)
2. **Edit JSON arguments** in the editor
3. **Click Execute** to run the tool
4. **View response** with syntax highlighting
5. **Browse history** of all requests

### Quick Start:
1. Select `searchProducts` from dropdown
2. Set arguments: `{"query": "headphones"}`
3. Click **▶ Execute Tool**
4. See mock product results!

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
✓ 493 tests passing
✓ All modules covered
✓ Unit + Integration tests
✓ Mock mode for isolated testing
```

---

## 🚀 Next Steps

1. **Connect to real Wix store** - Add Wix API credentials
2. **Deploy for production** - Configure production environment
3. **Integrate with AI agent** - Connect to Claude/GPT via MCP
4. **Customize branding** - Update merchant profile

---

## 📚 Resources

- **GitHub:** https://github.com/itayshmool/wix-ucp
- **API Docs:** https://wix-ucp-api.onrender.com/docs
- **UCP Spec:** https://ucp.dev

---

## 🙏 Thank You!

**Questions?** Try the live demo:

👉 [MCP Console](https://wix-ucp-api.onrender.com/test-ui/console) | [Flow Wizard](https://wix-ucp-api.onrender.com/test-ui/wizard)
