# Specification-First Development with Cursor Rules

## How We Built the Wix UCP Integration Without Writing Code First

---

## 🎯 The Challenge

Build a **complete UCP integration** for Wix e-commerce with:

- 6 complex modules
- 16 MCP tools
- 493+ tests
- Full API documentation
- Production deployment

**Traditional approach:** Jump into code, figure it out as we go

**Our approach:** Write specifications first, then generate code

---

## 💡 The Cursor Rules Methodology

### What are Cursor Rules?

Cursor Rules (`.mdc` files) are **markdown specification documents** that:

1. 📋 Define **what** to build
2. 🏗️ Specify **how** to structure it
3. ✅ Establish **quality standards**
4. 🤖 Guide **AI code generation**

Think of them as **executable blueprints** that Cursor AI can follow.

---

## 📁 Our Rule Structure

```
.cursor/rules/
├── 00-project-overview.mdc      # Master blueprint
├── modules/
│   ├── core-ucp.mdc            # Types, schemas, utilities
│   ├── payment-handler.mdc     # Payment tokenization
│   ├── checkout.mdc            # Checkout capability
│   ├── discovery.mdc           # Business profile
│   ├── identity.mdc            # OAuth linking
│   ├── orders.mdc              # Order management
│   └── mcp-bridge.mdc          # AI agent interface
├── infrastructure/
│   ├── deployment.mdc          # Render hosting
│   └── render-deployment.mdc   # Live deployment details
└── practices/
    ├── tdd.mdc                 # Test-driven development
    ├── testing.mdc             # Testing strategy
    └── security.mdc            # Security practices
```

---

## 📄 Rule #1: Project Overview

**File:** `00-project-overview.mdc`

### What it defines:

- 🎯 Project purpose and scope
- 🏗️ High-level architecture diagram
- 🛠️ Technology stack decisions
- 📦 Module responsibilities
- 📁 Directory structure
- 📝 Coding standards
- 🔄 Git workflow

### Key excerpt:

```markdown
## Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| `core-ucp` | UCP protocol types, schemas, utilities |
| `payment-handler` | Wix Payments tokenization as UCP handler |
| `checkout-capability` | UCP Checkout using Wix eCommerce |
| `discovery-profile` | Business profile advertisement |
| `mcp-bridge` | Bridge Wix MCP to UCP protocol |
| `identity-linking` | OAuth 2.0 account linking |
| `order-management` | Post-purchase order tracking |
```

---

## 📄 Rule #2: Core Types & Schemas

**File:** `modules/core-ucp.mdc`

### What it defines:

- 📊 All TypeScript interfaces
- ✅ Zod validation schemas
- 🔧 Utility function signatures
- 📌 Protocol constants
- ⚠️ Error types and codes

### Key excerpt:

```typescript
// Types defined BEFORE implementation
interface CheckoutSession {
  ucp: UCPVersion;
  id: string;
  status: CheckoutStatus;
  currency: string;
  buyer?: Buyer;
  lineItems: LineItem[];
  totals: Total[];
  payment?: PaymentInfo;
  // ...
}

type CheckoutStatus = 
  | 'incomplete'
  | 'ready_for_payment'
  | 'ready_for_complete'
  | 'completed'
  | 'expired'
  | 'cancelled';
```

---

## 📄 Rule #3: Module Specifications

**Files:** `modules/*.mdc`

### Each module rule defines:

1. **Purpose** - Why this module exists
2. **File structure** - Exact files to create
3. **API endpoints** - Request/response contracts
4. **Service interfaces** - Method signatures
5. **State machines** - Status transitions
6. **Test requirements** - What to test

### Example: Checkout Module

```markdown
## File Structure

src/modules/checkout/
├── index.ts              # Module exports
├── service.ts            # Main checkout service
├── session-manager.ts    # Session lifecycle
├── cart-mapper.ts        # Wix → UCP mapping
├── pricing-engine.ts     # Calculations
├── state-machine.ts      # Status transitions
├── types.ts              # Module types
└── routes.ts             # API endpoints
```

---

## 📄 Rule #4: TDD Enforcement

**File:** `practices/tdd.mdc`

### Mandatory Rules:

```markdown
- ❌ NEVER write implementation without a failing test first
- ❌ NEVER skip the red phase
- ✅ ALWAYS write test before implementation
- ✅ ALWAYS confirm test fails before implementing
```

### Red-Green-Refactor Cycle:

| Phase | Action |
|-------|--------|
| 🔴 **RED** | Write failing test |
| ✅ **GREEN** | Write minimal code to pass |
| 🔄 **REFACTOR** | Clean up while tests pass |

### Coverage Targets:

- Overall: **70%** minimum
- Business logic: **90%+**
- Payment flows: **95%+**

---

## 📄 Rule #5: Infrastructure

**File:** `infrastructure/deployment.mdc`

### Complete deployment spec:

```yaml
# Render services defined before writing code
services:
  - name: wix-ucp-api
    type: web_service
    runtime: node
    plan: starter
    
  - name: wix-ucp-db
    type: postgres
    plan: free
    
  - name: wix-ucp-redis
    type: redis
    plan: free
```

### Architecture diagram:

```
┌─────────────────────────────────────────────────┐
│                 RENDER PLATFORM                  │
│                                                  │
│   ┌────────────┐   ┌─────────┐   ┌─────────┐   │
│   │ Web Service│   │ Postgres│   │  Redis  │   │
│   │  (API)     │──▶│(Storage)│   │ (Cache) │   │
│   └────────────┘   └─────────┘   └─────────┘   │
└─────────────────────────────────────────────────┘
```

---

## 📄 Rule #6: Security Practices

**File:** `practices/security.mdc`

### Security requirements defined upfront:

| Area | Requirement |
|------|-------------|
| **Auth** | JWT with jose library |
| **Validation** | Zod schemas on all inputs |
| **Rate Limiting** | @fastify/rate-limit |
| **Headers** | @fastify/helmet |
| **Tokens** | 15-minute TTL, checkout-bound |
| **Secrets** | Environment variables only |

---

## 🔄 The Development Workflow

### Phase 1: Write Specifications (Rules)
```
📋 Define types → 📋 Define APIs → 📋 Define tests
```

### Phase 2: Generate Code (with Cursor)
```
🤖 "Implement the checkout module following checkout.mdc"
```

### Phase 3: Iterate & Refine
```
✅ Run tests → 🔧 Fix issues → 📝 Update rules
```

---

## 📊 Results: What We Achieved

| Metric | Value |
|--------|-------|
| **Modules** | 8 |
| **MCP Tools** | 16 |
| **Test Cases** | 493+ |
| **Code Coverage** | 70%+ |
| **API Endpoints** | 25+ |
| **Time to Deploy** | Hours, not weeks |

---

## 🎯 Benefits of Spec-First

### 1. **Clarity Before Complexity**
- Know exactly what you're building
- No scope creep or feature confusion

### 2. **Consistent Architecture**
- Same patterns across all modules
- Easy for AI to follow

### 3. **Built-in Quality**
- Tests defined before code
- Security baked in from start

### 4. **Faster Development**
- AI generates boilerplate
- Focus on business logic

### 5. **Self-Documenting**
- Rules ARE the documentation
- Always up to date

---

## 📝 Creating Your Own Rules

### Rule Template:

```markdown
# Module: [Name]

## Purpose
[One-line description]

## File Structure
[Directory tree]

## API Endpoints
[Request/Response specs]

## Service Interface
[Method signatures]

## Testing Requirements
[What to test]
```

### Tips:

1. **Be specific** - Include exact types, not just descriptions
2. **Be complete** - Cover error cases and edge conditions
3. **Be consistent** - Use same patterns across modules
4. **Be testable** - Define what success looks like

---

## 🔗 Our Complete Rule Set

| Rule File | Purpose |
|-----------|---------|
| `00-project-overview.mdc` | Master blueprint, architecture |
| `modules/core-ucp.mdc` | Types, schemas, utilities |
| `modules/payment-handler.mdc` | Tokenization spec |
| `modules/checkout.mdc` | Checkout capability |
| `modules/discovery.mdc` | Profile advertisement |
| `modules/identity.mdc` | OAuth linking |
| `modules/orders.mdc` | Order management |
| `modules/mcp-bridge.mdc` | AI agent interface |
| `infrastructure/deployment.mdc` | Render hosting |
| `practices/tdd.mdc` | Test-first rules |
| `practices/testing.mdc` | Testing strategy |
| `practices/security.mdc` | Security practices |

---

## 🚀 Key Takeaway

> **"The best code is the code you don't have to debug because it was specified correctly from the start."**

By writing **detailed specifications** in Cursor Rules before coding:

- ✅ Clear contracts between modules
- ✅ Consistent code generation
- ✅ Built-in test requirements
- ✅ Security by design
- ✅ Production-ready from day one

---

## 📚 Resources

- **GitHub:** https://github.com/itayshmool/wix-ucp
- **Rules folder:** `.cursor/rules/`
- **Live demo:** https://wix-ucp-api.onrender.com/test-ui/wizard

---

## 🙏 Thank You!

Questions about specification-first development?

**Browse the rules:** https://github.com/itayshmool/wix-ucp/tree/main/.cursor/rules
