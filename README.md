# OmniFlow

<div align="center">

English | [中文](README_CN.md)

**Game-Agnostic Industrial Line Solver — Visual Node Editor × SciPy Linear Programming**

[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)](https://react.dev/)
[![React Flow](https://img.shields.io/badge/React_Flow-11.11-ff0072?logo=reactflow)](https://reactflow.dev/)
[![Zustand](https://img.shields.io/badge/Zustand-5.0-433e38)](https://zustand.docs.pmnd.rs/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite)](https://vite.dev/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-latest-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![SciPy](https://img.shields.io/badge/SciPy-linprog-8CAAE6?logo=scipy)](https://scipy.org/)
[![Pydantic](https://img.shields.io/badge/Pydantic-2.x-E92063?logo=pydantic)](https://docs.pydantic.dev/)
[![Pure CSS](https://img.shields.io/badge/CSS-Dark_Industrial-1a1a2e)]()

</div>

---

## Introduction

The complexity of industrial automation games has long surpassed the limits of human mental calculation. When your Minecraft GregTech production line involves 40+ multiblock machines, cross-dimensional fluid supply, multiple energy hatch parallels, and directed overclocking, any spreadsheet or dedicated calculator collapses under the following dilemmas:

> **Hardcoded Hell** — Existing tools are deeply tied to specific mod versions, unable to adapt to custom modpacks or cross-game scenarios.
>
> **Contextual Ambiguity** — The same resource (like water) is consumed per-cycle as a recipe ingredient, yet consumed per-tick as a coolant in machine bases. Traditional single-dimensional data models cannot express this orthogonal relationship between nature and usage.
>
> **Computational Bottleneck** — Manual enumeration or iterative approximation either diverges or yields unacceptable precision when facing multi-objective coupling such as nonlinear overclocking, probabilistic byproducts, and global bus sharing.

**OmniFlow** combines simplex matrix solving from operations research with the node graph paradigm of industrial control consoles, providing a WYSIWYG, game-agnostic, math-driven industrial production line scheduling engine.

---

## Core Design Philosophy

### 1. Game-Agnostic

OmniFlow's foundation **contains no hardcoded game logic**. The system maps all physical entities through a configurable **Global Resource Registry** (powered by Zustand). Switching from Minecraft to Factorio or Dyson Sphere Program only requires changing the resource configuration — the core solving pipeline needs zero code modification.

```
Resource Registry  →  Category: 'gt:eu'  |  DisplayName: 'Greg Power'  |  Unit: 'EU/t'  |  Routing: global
                    →  Category: 'item'   |  DisplayName: 'Item'        |  Unit: 'pcs'   |  Routing: wired
                    →  Category: 'fluid'  |  DisplayName: 'Fluid'       |  Unit: 'mB'    |  Routing: wired
```

### 2. Nature vs. Context — Orthogonal Decoupling

This is OmniFlow's core data modeling breakthrough:

| Dimension | Storage Location | Description |
|-----------|------------------|-------------|
| **Nature** | `ResourceRegistry` global dictionary | Physical identity of matter: water, EU power, iron ingots; UI color and base unit |
| **Context** | Machine Archetype's `fixed_utilities` and recipe port's `measure_mode` | How this resource is **measured** in the current business flow: per-cycle (`per_cycle`), per-tick (`rate_per_tick`), per-second (`rate_per_sec`), and whether it's a read-only catalyst (`consumable: false`) |

This design completely solves the industry modeling pain point of "the same water being both a recipe ingredient and a coolant" — the material nature is defined once, while usage semantics attach to the machine base and recipe slots, orthogonally decoupled.

### 3. Math-First

The frontend handles all business logic (overclock cascading, parallelism, threshold judgment, probabilistic output). Before the request reaches the backend, a **Pre-compilation Pipeline** normalizes all discrete cycle amounts and continuous rate amounts into pure **Rate/s (per-second rate)**. The backend only needs to solve a standard form linear programming problem with `scipy.optimize.linprog`:

```
minimize  c^T x
subject to  A_ub x ≤ b_ub
            A_eq x = b_eq
            x ≥ 0
```

> The backend is stateless, mod-agnostic, receiving only normalized vectors and matrices, returning optimal solutions within 30ms.

---

## Key Architecture

### Machine Archetype & Slot System

Thoroughly separates **inherent machine properties** (energy type, cooling medium, routing lock) from **recipe I/O**:

```typescript
// gtElectric.ts — GregTech Electric Machine Archetype
{
  id: 'gt_electric',
  fixed_utilities: {
    'gt:eu': {
      type: 'gt:eu',
      routing_mode: 'global',      // Power goes through global bus, no manual wiring
      routing_locked: true,        // User cannot change routing type
      measure_mode: 'rate_per_tick' // EU consumed per tick
    }
  },
  default_modifiers: ['gt_multiblock']  // Activate multiblock energy hatch modifier by default
}
```

Fixed utilities reference the `ResourceRegistry` via foreign keys, enabling **dynamic suffix splicing** (e.g., `EU/t`, `mB/s`) and **visual noise reduction** (globally-routed ports auto-hide connection lines) in the UI.

### Smart Topology & Implicit Routing

Abandons tedious full-manual wiring, supporting two routing paradigms:

| Routing Mode | Semantics | Example |
|--------------|-----------|---------|
| `wired` | Must establish physical topology connections | Items, fluid pipes |
| `global` | Global implicit shared network | Power bus (gt:eu), Stress network (create:su) |

When building topological networks, the calculation engine automatically generates virtual source nodes (`Virtual_Global_Source`) and virtual sink nodes (`Virtual_Global_Target`) for `global` routed resources, eliminating the need for manual power input nodes and drastically reducing canvas complexity.

### Targeted Modifier Pipeline

Implements strict multi-stage modifier scope isolation, perfectly compatible with cross-mod hybrid energy machines:

```
Phase 1: Collect Effects     — Iterate activated modifiers, gather their ModifierEffects
Phase 2: Parallel             — Lossless parallel first: uniformly multiply by parallelMultiplier
Phase 3: Targeted Overclock   — Targeted exponential overclock: only matching utility_type gets multiplied
          Example: Hybrid machine consuming both gt:eu and create:su
              • gt:eu gets overclock-multiplied (×4^n)
              • create:su remains unaffected by overclock
Phase 4: Output Probability   — Probabilistic output (e.g., 5% byproduct chance)
Phase 5: Duration & Rate      — Normalize to Rate/s
```

For GregTech multiblocks, the `gt_multiblock` modifier strictly executes:
1. Calculate total input EU/t based on energy hatch configuration
2. Lossless parallel = `min(floor(total_eu / recipe_eu), parallelLimit)`
3. If remaining power is sufficient, execute overclocking (voltage ×4, perfect overclock duration ÷4, normal overclock ÷2)

### Zustand-Powered Resource Registry

The global resource category registry uses Zustand for fine-grained subscription. React components only re-render when the specific resource category they reference changes, avoiding the full-update disaster of React Context. Combined with React Flow's built-in `useNodesState` / `useEdgesState` for canvas state management, it ensures smooth 60fps dragging experience.

### Deterministic Pre-compilation

Full data normalization pipeline executed before every request:

1. **`normalizeCanvasNode`** — Compatible with legacy field migration (`is_virtual` → `is_auto`), fill default mode
2. **`ensureRecipeDataShape`** — Apply Archetype, filter incompatible modifiers, fill default UI state
3. **`buildTopologicalNets`** — Build topological networks, separate wired/global edges, generate implicit routing
4. **`getCalculatedRates`** — Execute modifier pipeline, normalize all resources to Rate/s

---

## How It Works

```
┌─────────────────────────────────────────────────┐
│                  React Flow Canvas               │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │ Source   │───▶│ Recipe   │───▶│ Target   │   │
│  │ water ∞  │    │ Electrolyzer│ │ H₂ 1.0   │   │
│  └──────────┘    └──────────┘    └──────────┘   │
│       │               │                           │
│  Physical Wires    Global Bus (gt:eu)             │
└───────┼───────────────┼───────────────────────────┘
        │               │
        ▼               ▼
┌─────────────────────────────────────────────────┐
│           Pre-compilation Pipeline               │
│  normalizeCanvasNode → ensureRecipeDataShape     │
│  → buildTopologicalNets → getCalculatedRates     │
│                                                  │
│  All amounts → Rate/s  (pure float vector)       │
└──────────────────────┬──────────────────────────┘
                       │ POST /api/calculate
                       ▼
┌─────────────────────────────────────────────────┐
│          FastAPI + SciPy LP Solver               │
│                                                  │
│  Pydantic validation → Node classification       │
│  → Stoichiometric matrix A construction          │
│  → Constraints c, bounds construction            │
│  → scipy.optimize.linprog (highs method)         │
│  → Result aggregation & rounding                 │
└──────────────────────┬──────────────────────────┘
                       │ Results
                       ▼
┌─────────────────────────────────────────────────┐
│          Result Mapping & UI Update              │
│                                                  │
│  machines_exact / machines_actual / utilization  │
│  actual_amounts per node / per port              │
│  system_inputs / system_outputs summary          │
│  total_eu_tick                                   │
└─────────────────────────────────────────────────┘
```

### Backend LP Formulation

**Variable vector**: `x = [x_recipes | x_sources | x_sinks]`

**Stoichiometric matrix**: Columns = Recipes, Rows = Items. Outputs positive, inputs negative.

**Objective modes**:

| Target Mode | Objective Coefficient | Constraint |
|-------------|----------------------|------------|
| `demand` | `c = 0` | `b_eq = amount` (exact demand) |
| `maximize` | `c = -10000` | `b_ub ≥ 0` (strong maximization) |
| `overflow` | `c = 0.001` | `b_eq = 0` (overflow discharge) |

**Constraints**: `Ax >= b` for non-target items (allow byproduct overflow). Target items enforce strict mass conservation.

---

## Development & Setup

### Prerequisites

- **Node.js** >= 18
- **Python** >= 3.10

### Frontend

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Type-check & build
npm run build

# Lint
npm run lint

# Preview production build
npm run preview
```

### Backend

```bash
cd backend

# Create & activate virtual environment (Windows)
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn numpy scipy pydantic

# Start backend (http://localhost:8000)
uvicorn main:app --reload
```

API docs available at [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI).

### Persistence

Canvas state is persisted to `localStorage` under key `omniflow.canvas.v1`. Export/import as `.json` files is supported via the file I/O controls.

---

## Project Structure

```
OmniFlow/
├── src/
│   ├── App.tsx                     # Root — React Flow canvas
│   ├── main.tsx                    # Entry point
│   ├── index.css                   # Dark industrial global styles (pure CSS)
│   ├── flowConfig.ts               # Node type registration (recipeNode / sourceNode / targetNode)
│   ├── components/                 # React UI components
│   │   ├── RecipeNode.tsx          # Polymorphic recipe node (gregtech / vanilla / enderio)
│   │   ├── SourceNode.tsx          # Input source node
│   │   ├── TargetNode.tsx          # Output target node
│   │   ├── RecipeEditorModal.tsx   # Recipe editor modal
│   │   ├── EndpointEditorModal.tsx # Endpoint editor modal
│   │   ├── SystemHUD.tsx           # System status heads-up display
│   │   ├── MenuBar.tsx             # Top menu bar
│   │   └── SegmentedControl.tsx    # Segmented control primitive
│   ├── hooks/                      # Custom React hooks
│   │   ├── useCanvasState.ts       # Nodes/edges state (React Flow)
│   │   ├── useCanvasOperations.ts  # Add / delete / connect operations
│   │   ├── useCalculation.ts       # Pre-compile → POST → result mapping pipeline
│   │   ├── useClipboard.ts         # Copy / paste / duplicate
│   │   ├── useFileIO.ts            # File import / export + localStorage
│   │   ├── useKeyboardShortcuts.ts # Global keyboard shortcuts
│   │   ├── useNodeEditor.ts        # Node editing modal state
│   │   ├── useNodeOperations.ts    # Auto-fill endpoints, node data updates
│   │   ├── useUndoRedo.ts          # Snapshot-based undo / redo (max 20)
│   │   └── useTheme.ts             # Dark / light theme toggle
│   ├── domain/canvas/
│   │   ├── initialState.ts         # Demo canvas (GregTech steel line)
│   │   └── validators.ts           # Data normalization & migration
│   ├── modifiers/                  # Modifier engine
│   │   ├── calculate.ts            # Core 5-phase modifier pipeline + rate normalization
│   │   ├── gtMultiblock.ts         # GT multiblock energy hatch & overclock logic
│   │   ├── chanceOutput.ts         # Probabilistic output modifier
│   │   ├── registry.ts             # Modifier registry (ID → IMachineModifier)
│   │   ├── state.ts                # Default UI state factory
│   │   ├── types.ts                # IMachineModifier & ModifierEffect interfaces
│   │   └── index.ts                # Barrel export
│   ├── data/archetypes/            # Machine archetype definitions
│   │   ├── index.ts                # Registry + applyArchetypeToInputs
│   │   ├── gtElectric.ts           # GT electric (fixed gt:eu utility + global routing)
│   │   ├── fluidNetworked.ts       # Fluid-cooled (utility:water per second)
│   │   ├── customGeneric.ts        # Blank archetype
│   │   └── shared.ts               # Utility amount derivation helpers
│   ├── registry/                   # Global resource category registry
│   │   ├── resourceRegistry.ts     # Zustand store (categories CRUD + localStorage)
│   │   ├── defaults.ts             # Built-in categories (item / fluid / energy / gt:eu / create:su …)
│   │   ├── types.ts                # ResourceCategoryDef type
│   │   ├── units.ts                # Unit definitions
│   │   └── index.ts                # Barrel export
│   ├── types/
│   │   ├── recipe.ts               # RecipeNodeData / SourceNodeData / TargetNodeData
│   │   ├── api.ts                  # CalculateResponse type
│   │   └── types.ts                # Resource / MachineArchetype / UtilityDef / RoutingMode
│   └── utils/
│       └── topologicalNets.ts      # Topological network analysis + global routing
├── backend/
│   └── main.py                     # FastAPI app + Pydantic models + SciPy LP solver
├── public/                         # Static assets
├── vite.config.ts
├── tsconfig.json                   # TypeScript project references root
├── tsconfig.app.json               # Frontend TS config
├── tsconfig.node.json              # Node-side TS config (vite.config)
├── eslint.config.js                # ESLint 10 flat config
└── package.json
```

---

## License

GPL-3.0 license
