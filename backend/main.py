import math
import logging
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError
from scipy.optimize import linprog

logger = logging.getLogger("omniflow")

# ── Net 命名常量 (与前端 resourceIdentifier.ts 保持同步) ──
VOID_PREFIX = "Void_"
NET_PREFIX = "Net_"
GLOBAL_PREFIX = "Global_"
VIRTUAL_GLOBAL_PREFIX = "Virtual_Global_"


def is_void_name(name: str) -> bool:
    """Check if a resource identifier represents a void port.
    
    Void ports (prefixed with 'Void_') are isolated endpoints that should be 
    directly discarded from the material balance constraints.
    
    Args:
        name: The resource identifier to check.
    
    Returns:
        True if the name starts with VOID_PREFIX, False otherwise.
    
    Example:
        >>> is_void_name("Void_Heat")
        True
        >>> is_void_name("Net_Power")
        False
    """
    return name.startswith(VOID_PREFIX)


def is_net_name(name: str) -> bool:
    """Check if a resource identifier represents a networked item.
    
    Networked items (prefixed with 'Net_') are connected through physical 
    conduits and participate in the topological network analysis.
    
    Args:
        name: The resource identifier to check.
    
    Returns:
        True if the name starts with NET_PREFIX, False otherwise.
    
    Example:
        >>> is_net_name("Net_Electricity")
        True
        >>> is_net_name("Global_Steam")
        False
    """
    return name.startswith(NET_PREFIX)


# =====================================================================
# 1. 基础环境与 FastAPI 实例初始化
# =====================================================================
app = FastAPI(
    title="OmniFlow Backend",
    description="Backend calculation engine for the production line calculator",
    version="0.1.0"
)

# Configure CORS middleware to allow cross-origin requests from the frontend.
# In development, localhost:5173 is allowed. In production, replace '*' with 
# specific domain names for security.
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "*",  # Allow all origins for development; restrict in production
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================================
# 2. Pydantic 数据模型定义 (API 契约)
# =====================================================================
class RecipeNodeData(BaseModel):
    """Data model for recipe node configuration.
    
    Represents a processing machine in the production flow with defined 
    input/output rates and operational constraints.
    
    Attributes:
        recipe_id: Unique identifier for the recipe being executed.
        machine_name: Display name for the machine in the UI.
        system: The mod/system this machine belongs to (e.g., 'gregtech').
        inputs: Dictionary mapping resource identifiers to input rates (items/s).
        outputs: Dictionary mapping resource identifiers to output rates (items/s).
        mode: Operation mode - 'auto' for unlimited, 'limit' for manual cap.
        manual_machines: Maximum number of machines when mode is 'limit'.
        metadata: Additional machine-specific configuration data.
    """
    recipe_id: str = Field("", description="Recipe ID")
    machine_name: str = Field("Recipe", description="Machine name")
    system: Optional[str] = Field(None, description="Mod system")
    inputs: Dict[str, float] = Field(default_factory=dict, description="Input rates")
    outputs: Dict[str, float] = Field(default_factory=dict, description="Output rates")
    mode: Optional[str] = Field(None, description="Operation mode: auto|limit")
    manual_machines: Optional[float] = Field(None, description="Manual machine cap")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Machine metadata")


class SourceNodeData(BaseModel):
    """Data model for source node (input provider).
    
    Represents an external source that provides resources to the production flow.
    
    Attributes:
        id: The resource identifier being supplied.
        amount: The supply rate or total amount available.
        mode: Supply mode - 'infinite' for unlimited, 'limit' for capped supply.
        actual_amounts: Backend-calculated actual throughput per port (for multi-port sources).
    """
    id: str = Field(..., description="Resource ID")
    amount: float = Field(0, description="Amount/rate")
    mode: Optional[str] = Field(None, description="Supply mode: infinite|limit")
    actual_amounts: Optional[Dict[str, float]] = Field(None, description="Calculated throughput")


class TargetNodeData(BaseModel):
    """Data model for target node (output consumer).
    
    Represents an external sink that consumes resources from the production flow.
    
    Attributes:
        id: The resource identifier being consumed.
        amount: The demand rate or target amount.
        mode: Target mode - 'demand' for fixed requirement, 'maximize' for unbounded output,
              'overflow' for excess disposal.
        actual_amounts: Backend-calculated actual throughput per port (for multi-port targets).
    """
    id: str = Field(..., description="Resource ID")
    amount: float = Field(0, description="Amount/rate")
    mode: Optional[str] = Field(None, description="Target mode: demand|maximize|overflow")
    actual_amounts: Optional[Dict[str, float]] = Field(None, description="Calculated throughput")


class GraphNode(BaseModel):
    """Data model for a node in the React Flow graph.
    
    Generic wrapper for any node type in the production flow diagram.
    
    Attributes:
        id: Unique identifier for the node in the graph.
        type: Node type discriminator - 'recipeNode', 'sourceNode', or 'targetNode'.
        data: Node-specific data payload matching the corresponding data model.
    """
    id: str = Field(..., description="Unique node identifier")
    type: str = Field(..., description="Node type: recipeNode|sourceNode|targetNode")
    data: Dict[str, Any] = Field(default_factory=dict, description="Node data payload")


class GraphEdge(BaseModel):
    """Data model for an edge (connection) in the React Flow graph.
    
    Represents a material flow connection between two nodes.
    
    Attributes:
        source: The source node's ID.
        target: The target node's ID.
        sourceHandle: The resource identifier flowing out of the source.
        targetHandle: The resource identifier flowing into the target.
    """
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    sourceHandle: Optional[str] = Field(None, description="Output resource ID")
    targetHandle: Optional[str] = Field(None, description="Input resource ID")


class CalculateRequest(BaseModel):
    """Request payload for the /api/calculate endpoint.
    
    Contains the complete graph representation of the production flow to be solved.
    
    Attributes:
        nodes: List of all nodes in the production flow graph.
        edges: List of all connections between nodes.
    """
    nodes: List[GraphNode] = Field(..., description="All graph nodes")
    edges: List[GraphEdge] = Field(..., description="All graph edges")


# =====================================================================
# 3. 路由与 Mock 解算接口
# =====================================================================
@app.post("/api/calculate", summary="提交工艺图解算请求")
async def calculate_flow(request: CalculateRequest):
    """Receive React Flow graph data and perform topology analysis and recipe solving.
    
    Uses linear programming (SciPy linprog) to solve material balance constraints
    for the production flow graph. Supports multiple node types (recipe, source, target)
    and operation modes.
    
    Args:
        request: CalculateRequest object containing nodes and edges.
    
    Returns:
        dict: Calculation result with the following fields:
            - status: Solver status (success/unbounded/infeasible)
            - node_results: Machine counts and utilization per node
            - system_inputs: Total system input rates
            - system_outputs: Total system output rates
    
    Raises:
        ValidationError: If node data format is invalid.
    
    Note:
        - Void_ prefixed ports are directly discarded from constraints
        - Spill variables use dynamic Big-M method (White Paper §7.3.4)
    """
    nodes = request.nodes
    edges = request.edges

    def parse_model(model_cls, payload):
        """Parse payload into Pydantic model, supporting both v1 and v2 APIs."""
        if hasattr(model_cls, "model_validate"):
            return model_cls.model_validate(payload)
        return model_cls.parse_obj(payload)

    recipe_nodes: List[Dict[str, Any]] = []
    source_nodes: List[Dict[str, Any]] = []
    target_nodes: List[Dict[str, Any]] = []

    for node in nodes:
        try:
            if node.type == "recipeNode":
                recipe_data = parse_model(RecipeNodeData, node.data)
                recipe_nodes.append({"node_id": node.id, "data": recipe_data})
            elif node.type == "sourceNode":
                source_nodes.append({"node_id": node.id, "data": parse_model(SourceNodeData, node.data)})
            elif node.type == "targetNode":
                target_nodes.append({"node_id": node.id, "data": parse_model(TargetNodeData, node.data)})
        except ValidationError as e:
            logger.warning("Skipping invalid node %s: %s", node.id, e)

    # Step 1: Parse network, extract all items and build index
    items: List[str] = []
    item_index: Dict[str, int] = {}

    def ensure_item(item_id: str) -> None:
        """Ensure item exists in the index, adding if necessary."""
        if item_id not in item_index:
            item_index[item_id] = len(items)
            items.append(item_id)

    for recipe in recipe_nodes:
        recipe_data: RecipeNodeData = recipe["data"]
        for item_id in recipe_data.inputs:
            ensure_item(item_id)
        for item_id in recipe_data.outputs:
            ensure_item(item_id)

    # Also include items that only appear in source/target nodes
    for source in source_nodes:
        ensure_item(source["data"].id)
    for target in target_nodes:
        ensure_item(target["data"].id)

    # Step 2: Build unified variable vector x = [x_recipes | x_sources | x_sinks]
    recipe_count = len(recipe_nodes)
    source_count = len(source_nodes)
    sink_count = len(target_nodes)
    source_start = recipe_count
    sink_start = recipe_count + source_count
    total_vars = recipe_count + source_count + sink_count

    item_rows: Dict[str, np.ndarray] = {
        item_id: np.zeros(total_vars, dtype=float)
        for item_id in items
    }

    # Write item coefficients for all nodes (must be done before building spill)
    for col, recipe in enumerate(recipe_nodes):
        recipe_data: RecipeNodeData = recipe["data"]
        for item_id, rate in recipe_data.outputs.items():
            item_rows[item_id][col] += rate
        for item_id, rate in recipe_data.inputs.items():
            item_rows[item_id][col] -= rate

    source_specs: List[Dict[str, Any]] = []
    for offset, source in enumerate(source_nodes):
        source_data: SourceNodeData = source["data"]
        source_col = source_start + offset
        src_mode = source_data.mode or 'infinite'
        item_rows[source_data.id][source_col] += 1.0
        source_specs.append({
            "node_id": source["node_id"],
            "item_id": source_data.id,
            "col": source_col,
            "mode": src_mode,
            "amount": source_data.amount,
        })

    sink_specs: List[Dict[str, Any]] = []
    for offset, target in enumerate(target_nodes):
        target_data: TargetNodeData = target["data"]
        sink_col = sink_start + offset
        tgt_mode = target_data.mode or 'maximize'
        item_rows[target_data.id][sink_col] -= 1.0
        sink_specs.append({
            "node_id": target["node_id"],
            "item_id": target_data.id,
            "col": sink_col,
            "mode": tgt_mode,
            "amount": target_data.amount,
        })

    # Step 2.5: Identify spill items and extend matrix (White Paper §7.2.2)
    # Void_ ports = directly discarded, no conservation constraint, no spill variable
    # Use spill soft constraint for all non-Void items: Ax - v_k = 0
    spill_items: List[str] = []
    spill_index: Dict[str, int] = {}
    for item_id in items:
        if is_void_name(item_id):
            continue
        row = item_rows[item_id]
        if bool(np.any(row > 1e-12)):
            spill_items.append(item_id)
            spill_index[item_id] = len(spill_items) - 1

    spill_count = len(spill_items)
    spill_start = total_vars
    total_vars += spill_count

    for item_id in items:
        item_rows[item_id] = np.append(item_rows[item_id], np.zeros(spill_count, dtype=float))
    for spill_item in spill_items:
        item_rows[spill_item][spill_start + spill_index[spill_item]] = -1.0

    # Step 3: Build objective function c and variable bounds
    c = np.zeros(total_vars, dtype=float)
    bounds: List[tuple[float, Optional[float]]] = []
    for col, recipe in enumerate(recipe_nodes):
        recipe_data: RecipeNodeData = recipe["data"]
        recipe_mode = recipe_data.mode or 'auto'
        c[col] = 1.0
        if recipe_mode == 'auto' or recipe_data.manual_machines is None:
            bounds.append((0, None))
        else:
            manual_cap = max(0.0, float(recipe_data.manual_machines))
            bounds.append((0, manual_cap))

    for source in source_specs:
        src_mode = source["mode"]
        upper_bound = max(0.0, float(source["amount"])) if src_mode == 'limit' else None
        bounds.append((0, upper_bound))

    for sink in sink_specs:
        tgt_mode = sink["mode"]
        demand_amt = max(0.0, float(sink["amount"]))
        if tgt_mode == 'demand':
            c[sink["col"]] = 0.0
            bounds.append((demand_amt, None))
        elif tgt_mode == 'maximize':
            c[sink["col"]] = -10000.0
            bounds.append((0, None))
        else:
            c[sink["col"]] = 0.001
            bounds.append((0, None))

    # Dynamic Big-M (White Paper §7.3.4): spill penalty = max(1,000,000, max(|c_user|) × 10)
    user_weights = [abs(c[col]) for col in range(spill_start) if abs(c[col]) > 0]
    _spill_m = max(1_000_000, (max(user_weights) * 10) if user_weights else 1)

    for i in range(spill_count):
        c[spill_start + i] = _spill_m
        bounds.append((0, None))

    # Step 4: Build constraints (White Paper §7.2.3)
    # Void_ ports have no constraint - directly discarded
    A_eq_rows: List[List[float]] = []
    b_eq: List[float] = []
    A_ub_rows: List[List[float]] = []
    b_ub: List[float] = []

    for item_id in items:
        row = item_rows[item_id]
        if is_void_name(item_id):
            continue
        if item_id in spill_index:
            A_eq_rows.append(row.tolist())
            b_eq.append(0.0)

    A_eq = np.array(A_eq_rows, dtype=float) if A_eq_rows else None
    b_eq_arr = np.array(b_eq, dtype=float) if b_eq else None
    A_ub = np.array(A_ub_rows, dtype=float) if A_ub_rows else None
    b_ub_arr = np.array(b_ub, dtype=float) if b_ub else None

    # Step 5: Solve with SciPy
    if total_vars == 0:
        return {
            "status": "success",
            "node_results": {},
            "system_inputs": {},
            "system_outputs": {},
        }

    res = linprog(
        c,
        A_ub=A_ub,
        b_ub=b_ub_arr,
        A_eq=A_eq,
        b_eq=b_eq_arr,
        bounds=bounds,
        method="highs",
    )

    if res.status == 3:  # INFEASIBLE_OR_UNBOUNDED / Unbounded
        return {
            "status": "unbounded",
            "message": "Found maximize node but no physical bottleneck. Set a machine cap or source limit upstream.",
        }
    if not res.success:
        return {
            "status": "infeasible",
            "message": res.message,
        }

    # Step 6: Format and return results
    node_results: Dict[str, Dict[str, float]] = {}
    rounding_eps = 1e-8
    for idx, recipe in enumerate(recipe_nodes):
        recipe_data: RecipeNodeData = recipe["data"]
        exact_rate = float(res.x[idx])
        machines_actual = math.ceil(exact_rate - rounding_eps)
        utilization = exact_rate / machines_actual if machines_actual > 0 else 0.0

        key = recipe_data.recipe_id or recipe["node_id"]
        if key in node_results:
            key = recipe["node_id"]

        node_results[key] = {
            "machines_exact": exact_rate,
            "machines_actual": machines_actual,
            "utilization": utilization,
        }

    for source_spec in source_specs:
        raw_value = float(res.x[source_spec["col"]])
        actual_value = 0.0 if abs(raw_value) <= 1e-6 else raw_value
        node_results[source_spec["node_id"]] = {
            "actual_amounts": {source_spec["item_id"]: actual_value},
        }

    for sink_spec in sink_specs:
        raw_value = float(res.x[sink_spec["col"]])
        actual_value = 0.0 if abs(raw_value) <= 1e-6 else raw_value
        node_results[sink_spec["node_id"]] = {
            "actual_amounts": {sink_spec["item_id"]: actual_value},
        }

    # Full matrix back-substitution
    full_matrix = np.array([item_rows[item_id] for item_id in items], dtype=float)
    net_rates = full_matrix @ res.x

    system_inputs: Dict[str, float] = {}
    system_outputs: Dict[str, float] = {}
    for i, item_id in enumerate(items):
        net = float(net_rates[i])
        if net > 1e-6:
            system_outputs[item_id] = net
        elif net < -1e-6:
            system_inputs[item_id] = -net

    return {
        "status": "success",
        "node_results": node_results,
        "system_inputs": system_inputs,
        "system_outputs": system_outputs,
    }


@app.post("/api/debug", summary="诊断：转储矩阵构建过程")
async def debug_matrix(request: CalculateRequest):
    """Dump matrix construction process for debugging without solving.
    
    Follows the same logic as /api/calculate but returns diagnostic information
    about the constraint matrix, variable bounds, and objective coefficients
    instead of solving the linear program.
    
    Args:
        request: CalculateRequest object containing nodes and edges.
    
    Returns:
        dict: Diagnostic information including:
            - nodes_summary: Counts of recipes, sources, targets, spills
            - variables: List of variable names
            - variable_bounds: Bounds for each variable
            - objective_coeffs: Objective function coefficients
            - constraint_details: Detailed constraint information per item
            - edges_received: All edges with handles
    """
    import json

    nodes = request.nodes
    edges = request.edges

    def parse_model(model_cls, payload):
        """Parse payload into Pydantic model, supporting both v1 and v2 APIs."""
        if hasattr(model_cls, "model_validate"):
            return model_cls.model_validate(payload)
        return model_cls.parse_obj(payload)

    recipe_nodes: List[Dict[str, Any]] = []
    source_nodes: List[Dict[str, Any]] = []
    target_nodes: List[Dict[str, Any]] = []

    for node in nodes:
        try:
            if node.type == "recipeNode":
                recipe_data = parse_model(RecipeNodeData, node.data)
                recipe_nodes.append({"node_id": node.id, "data": recipe_data})
            elif node.type == "sourceNode":
                source_nodes.append({"node_id": node.id, "data": parse_model(SourceNodeData, node.data)})
            elif node.type == "targetNode":
                target_nodes.append({"node_id": node.id, "data": parse_model(TargetNodeData, node.data)})
        except ValidationError as e:
            logger.warning("Skipping invalid node %s: %s", node.id, e)

    items: List[str] = []
    item_index: Dict[str, int] = {}

    def ensure_item(item_id: str) -> None:
        """Ensure item exists in the index, adding if necessary."""
        if item_id not in item_index:
            item_index[item_id] = len(items)
            items.append(item_id)

    for recipe in recipe_nodes:
        recipe_data: RecipeNodeData = recipe["data"]
        for item_id in recipe_data.inputs:
            ensure_item(item_id)
        for item_id in recipe_data.outputs:
            ensure_item(item_id)
    for source in source_nodes:
        ensure_item(source["data"].id)
    for target in target_nodes:
        ensure_item(target["data"].id)

    recipe_count = len(recipe_nodes)
    source_count = len(source_nodes)
    sink_count = len(target_nodes)
    source_start = recipe_count
    sink_start = recipe_count + source_count
    total_vars = recipe_count + source_count + sink_count

    item_rows: Dict[str, np.ndarray] = {
        item_id: np.zeros(total_vars, dtype=float)
        for item_id in items
    }

    # Write item coefficients for all nodes (must be done before building spill)
    for col, recipe in enumerate(recipe_nodes):
        recipe_data: RecipeNodeData = recipe["data"]
        for item_id, rate in recipe_data.outputs.items():
            item_rows[item_id][col] += rate
        for item_id, rate in recipe_data.inputs.items():
            item_rows[item_id][col] -= rate

    source_specs: List[Dict[str, Any]] = []
    for offset, source in enumerate(source_nodes):
        source_data: SourceNodeData = source["data"]
        source_col = source_start + offset
        src_mode = source_data.mode or 'infinite'
        item_rows[source_data.id][source_col] += 1.0
        source_specs.append({
            "node_id": source["node_id"],
            "item_id": source_data.id,
            "col": source_col,
            "mode": src_mode,
            "amount": source_data.amount,
        })

    sink_specs: List[Dict[str, Any]] = []
    for offset, target in enumerate(target_nodes):
        target_data: TargetNodeData = target["data"]
        sink_col = sink_start + offset
        tgt_mode = target_data.mode or 'maximize'
        item_rows[target_data.id][sink_col] -= 1.0
        sink_specs.append({
            "node_id": target["node_id"],
            "item_id": target_data.id,
            "col": sink_col,
            "mode": tgt_mode,
            "amount": target_data.amount,
        })

    # Step 2.5: Identify spill items (White Paper §7.2.2)
    spill_items2: List[str] = []
    spill_index2: Dict[str, int] = {}
    for item_id in items:
        if is_void_name(item_id):
            continue
        row = item_rows[item_id]
        if bool(np.any(row > 1e-12)):
            spill_items2.append(item_id)
            spill_index2[item_id] = len(spill_items2) - 1

    spill_count2 = len(spill_items2)
    spill_start2 = total_vars
    total_vars += spill_count2

    for item_id in items:
        item_rows[item_id] = np.append(item_rows[item_id], np.zeros(spill_count2, dtype=float))
    for spill_item in spill_items2:
        item_rows[spill_item][spill_start2 + spill_index2[spill_item]] = -1.0

    c = np.zeros(total_vars, dtype=float)
    bounds: List[tuple[float, Optional[float]]] = []
    for col, recipe in enumerate(recipe_nodes):
        recipe_data: RecipeNodeData = recipe["data"]
        recipe_mode = recipe_data.mode or 'auto'
        c[col] = 1.0
        if recipe_mode == 'auto' or recipe_data.manual_machines is None:
            bounds.append((0, None))
        else:
            manual_cap = max(0.0, float(recipe_data.manual_machines))
            bounds.append((0, manual_cap))

    for source in source_specs:
        src_mode = source["mode"]
        upper_bound = max(0.0, float(source["amount"])) if src_mode == 'limit' else None
        bounds.append((0, upper_bound))

    for sink in sink_specs:
        tgt_mode = sink["mode"]
        demand_amt = max(0.0, float(sink["amount"]))
        if tgt_mode == 'demand':
            c[sink["col"]] = 0.0
            bounds.append((demand_amt, None))
        elif tgt_mode == 'maximize':
            c[sink["col"]] = -10000.0
            bounds.append((0, None))
        else:
            c[sink["col"]] = 0.001
            bounds.append((0, None))

    # Dynamic Big-M (White Paper §7.3.4)
    user_weights2 = [abs(c[col]) for col in range(spill_start2) if abs(c[col]) > 0]
    _spill_m2 = max(1_000_000, (max(user_weights2) * 10) if user_weights2 else 1)

    for i in range(spill_count2):
        c[spill_start2 + i] = _spill_m2
        bounds.append((0, None))

    # Build constraints
    A_eq_rows: List[List[float]] = []
    b_eq: List[float] = []
    A_ub_rows: List[List[float]] = []
    b_ub: List[float] = []
    constraint_details: List[Dict[str, Any]] = []

    for item_id in items:
        row = item_rows[item_id]
        detail = {
            "item_id": item_id,
            "row": [round(v, 6) for v in row.tolist()],
            "has_positive": bool(np.any(row > 1e-12)),
            "has_negative": bool(np.any(row < -1e-12)),
        }
        if is_void_name(item_id):
            detail["constraint"] = "skip (Void — directly discarded)"
        elif item_id in spill_index2:
            A_eq_rows.append(row.tolist())
            b_eq.append(0.0)
            detail["constraint"] = f"soft_eq + spill (M={_spill_m2})"
        else:
            detail["constraint"] = "skip (no positive coefficients)"
        constraint_details.append(detail)

    # Variable names
    var_names: List[str] = []
    for i, r in enumerate(recipe_nodes):
        var_names.append(f"Recipe[{r['node_id']}]")
    for i, s in enumerate(source_nodes):
        var_names.append(f"Source[{s['node_id']}]")
    for i, t in enumerate(target_nodes):
        var_names.append(f"Sink[{t['node_id']}]")
    for spill_item in spill_items2:
        var_names.append(f"Spill[{spill_item}]")

    return {
        "nodes_summary": {
            "recipe_count": recipe_count,
            "source_count": source_count,
            "target_count": sink_count,
            "spill_count": spill_count2,
            "total_vars": total_vars,
            "spill_m": _spill_m2,
        },
        "variables": var_names,
        "variable_bounds": [[float(b[0]), b[1]] for b in bounds],
        "objective_coeffs": [float(x) for x in c.tolist()],
        "edges_received": [
            {"source": e.source, "target": e.target, "sourceHandle": e.sourceHandle, "targetHandle": e.targetHandle}
            for e in edges
        ],
        "items": items,
        "constraint_details": constraint_details,
        "equality_rows_count": len(A_eq_rows),
        "inequality_rows_count": len(A_ub_rows),
        "b_eq": b_eq,
        "b_ub": b_ub,
    }
