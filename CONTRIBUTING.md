# Contributing to OmniFlow

English | [中文](docs/CONTRIBUTING.zh-CN.md)

Thank you for your interest in OmniFlow! OmniFlow aims to be the next-generation, game-agnostic industrial scheduling solver. Whether you want to fix a bug, add a modifier for a hardcore mod, or optimize the underlying simplex matrix algorithm, your contributions are highly welcome.

Before submitting a Pull Request (PR), please make sure to read the following architectural guidelines and development standards.

## 🧠 Core Architecture Philosophy

OmniFlow's underlying design follows an extremely strict decoupling of physics and mathematics. Before writing any code, please ensure you understand our three foundational pillars:

1. **Game-Agnostic**:
   The system does not "know" *Minecraft*, *Factorio*, or *Dyson Sphere Program*. Everything is mapped via a configuration-driven `Global Resource Registry`. **Never hardcode mod-specific resource IDs or physical logic in the core rendering or calculation pipelines.**
2. **Nature vs. Context (Orthogonal Decoupling)**:
   * The `Registry` is solely responsible for defining the "Nature" of a resource (e.g., base physical units, UI colors).
   * The `Slot/Port` of a machine or recipe defines the "Context" or usage (e.g., measurement mode, whether it's a non-consumable catalyst, durability expectations).
3. **Math-First (Pre-compilation Pipeline)**:
   The frontend `Payload Compiler` handles all complex business logic (overclocking, lossless parallelism, durability conversion) and normalizes everything into a pure "Rate per second (Rate/s)". The backend SciPy solver acts entirely "blind" and focuses only on solving the $Ax = b$ matrix at maximum speed.

---

## 🛠️ Directory Guide (Where to Contribute)

If you want to add new features, please strictly adhere to the existing domain-driven directory structure:

* **Adding a new global resource type?**
  👉 Modify `src/registry/defaults.ts` (e.g., adding `factorio:watt`).
* **Adding new machine archetype logic?**
  👉 Create a new archetype definition in `src/data/archetypes/` and register it in `index.ts`.
* **Adding mod-specific overclocking/mechanics?**
  👉 Create a new modifier logic in `src/modifiers/`. You must adhere to the 5-phase pipeline standard and never pollute other scopes.
* **Optimizing topological analysis or implicit routing?**
  👉 Focus your changes in `src/utils/topologicalNets.ts`.
* **Optimizing matrix solver performance?**
  👉 Your battlefield is `backend/main.py`.

---

## 💻 Local Development Setup

This project uses a frontend/backend separated Monorepo structure.

### Frontend (Vite + React + Zustand)
1. Ensure Node.js (v18+ recommended) and a package manager (`pnpm` recommended) are installed.
2. Enter the root directory:
   ```bash
   pnpm install
   pnpm run dev
   ```

### Backend (FastAPI + SciPy)
1. Ensure Python 3.10+ is installed.
2. Navigate to the `backend` directory, create and activate a virtual environment:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```
3. Install dependencies and start the server:
   ```bash
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

---

## 📝 Coding Standards

* **TypeScript**:
  * Strict mode is enabled. **Do not use `any`**. Use `unknown` for unknown types or define specific Interfaces.
  * For state management, prioritize Zustand to avoid React Context rendering hell.
* **Python**:
  * Follow PEP 8 guidelines.
  * Type Hinting combined with Pydantic for data validation is mandatory.
* **Styling (CSS)**:
  * Global styles are contained in `index.css`.
  * For component-level styling, use Tailwind CSS utility classes to maintain the unified "Dark Industrial" visual theme.

---

## 🌿 Git Workflow

1. **Fork the repository** and clone it locally.
2. **Create a branch**: Create a feature branch based on `main`.
   * Feature: `feat/add-create-mod-archetype`
   * Bug fix: `fix/matrix-solver-division-by-zero`
   * Documentation: `docs/update-readme`
3. **Conventional Commits**:
   Commit messages must be clear and formatted as follows:
   * `feat: add support for probabilistic output modifiers`
   * `fix(modifier): fix bug where non-consumable catalysts were not excluded during overclocking`
   * `refactor(pipeline): optimize dimensional reduction logic in payload compiler`
4. **Submit a Pull Request**:
   * Clearly explain the problem you solved in the PR description.
   * If it includes UI changes, please attach screenshots.
   * If you modified the core calculation pipeline (`calculate.ts` or `main.py`), please explain the edge cases you tested.

> *"The factory must grow, and the math must flow."* > We look forward to your code! Let's build the most resilient industrial scheduling engine together.
