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
    """Void_xxx → 孤立端口，直接排空"""
    return name.startswith(VOID_PREFIX)


def is_net_name(name: str) -> bool:
    """Net_xxx → 有线连通分量"""
    return name.startswith(NET_PREFIX)

# =====================================================================
# 1. 基础环境与 FastAPI 实例初始化
# =====================================================================
app = FastAPI(
    title="OmniFlow Backend",
    description="Backend calculation engine for the production line calculator",
    version="0.1.0"
)

# 配置 CORS，允许前端跨域访问
# 开发环境放行 localhost，线上环境根据实际域名配置
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "*",  # 内网测试可临时放开，生产环境建议配置具体域名
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
    recipe_id: str = Field("", description="配方 ID")
    machine_name: str = Field("Recipe", description="机器名称")
    system: Optional[str] = Field(None, description="所属模组")
    duration_ticks: float = Field(20.0, description="归一化后固定为 20 (所有速率为 /s)")
    inputs: Dict[str, float] = Field(default_factory=dict, description="输入速率: {category:id → rate/s}")
    outputs: Dict[str, float] = Field(default_factory=dict, description="输出速率: {category:id → rate/s}")
    mode: Optional[str] = Field(None, description="运行模式: auto|limit；None 时回退到 is_auto")
    is_auto: bool = Field(True, description="已弃用，由mode替代")
    manual_machines: Optional[float] = Field(None, description="手动设定产能上限机器数量")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="机器元数据")


class SourceNodeData(BaseModel):
    id: str = Field(..., description="物品 ID")
    label: Optional[str] = Field(None, description="显示名称")
    amount: float = Field(..., description="最大供应速率")
    system: Optional[str] = Field(None, description="所属模组")
    mode: Optional[str] = Field(None, description="供应模式: infinite|limit；None 时回退到 is_auto")
    is_auto: bool = Field(True, description="已弃用，由mode替代")
    actual_amount: Optional[float] = Field(None, description="后端计算后的实际吞吐量")


class TargetNodeData(BaseModel):
    id: str = Field(..., description="物品 ID")
    label: Optional[str] = Field(None, description="显示名称")
    amount: float = Field(..., description="目标需求速率")
    system: Optional[str] = Field(None, description="所属模组")
    mode: Optional[str] = Field(None, description="目标模式: demand|maximize|overflow；None 时回退到 is_auto")
    is_auto: bool = Field(True, description="已弃用，由mode替代")
    actual_amount: Optional[float] = Field(None, description="后端计算后的实际吞吐量")


class GraphNode(BaseModel):
    id: str = Field(..., description="节点的唯一标识符")
    type: str = Field(..., description="节点类型，如 'recipeNode', 'sourceNode', 'targetNode'")
    data: Dict[str, Any] = Field(default_factory=dict, description="节点数据负载")
    recipe_id: Optional[str] = Field(None, description="兼容旧字段：配方节点对应的配方 ID")
    target_rate: Optional[float] = Field(None, description="兼容旧字段：目标节点的期望产出率")

class GraphEdge(BaseModel):
    source: str = Field(..., description="起点的节点 ID")
    target: str = Field(..., description="终点的节点 ID")
    sourceHandle: Optional[str] = Field(None, description="对应连线流转的物品 ID")
    targetHandle: Optional[str] = Field(None, description="目标端口的物品 ID")

class CalculateRequest(BaseModel):
    nodes: List[GraphNode] = Field(..., description="前端传递的所有工艺图节点")
    edges: List[GraphEdge] = Field(..., description="前端传递的所有工艺图连线")
    equality_items: List[str] = Field(default_factory=list, description="需要等式约束（sum=0）的物品 ID 列表。前端通过 Edge 连通性判定：产出端有下游连线的物品进入此列表")


# =====================================================================
# 3. 路由与 Mock 解算接口
# =====================================================================
@app.post("/api/calculate", summary="提交工艺图解算请求")
async def calculate_flow(request: CalculateRequest):
    """
    接收前端 React Flow 图表数据，进行拓扑分析和配方解算。
    """
    nodes = request.nodes
    edges = request.edges

    def parse_model(model_cls, payload):
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

    # 步骤 1：解析网络，提取物品全集与变量映射
    items: List[str] = []
    item_index: Dict[str, int] = {}

    def ensure_item(item_id: str) -> None:
        if item_id not in item_index:
            item_index[item_id] = len(items)
            items.append(item_id)

    for recipe in recipe_nodes:
        recipe_data: RecipeNodeData = recipe["data"]
        for item_id in recipe_data.inputs:
            ensure_item(item_id)
        for item_id in recipe_data.outputs:
            ensure_item(item_id)

    # 额外补齐只在 source/target 中出现的物品，避免缺失行
    for source in source_nodes:
        ensure_item(source["data"].id)
    for target in target_nodes:
        ensure_item(target["data"].id)

    # 步骤 2：统一变量向量 x = [x_recipes | x_sources | x_sinks]
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

    # 步骤 2：写入所有节点的物品系数（必须在构建 spill 之前完成）
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
        src_mode = getattr(source_data, 'mode', None) or ('infinite' if source_data.is_auto else 'limit')
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
        tgt_mode = getattr(target_data, 'mode', None) or ('maximize' if target_data.is_auto else 'demand')
        item_rows[target_data.id][sink_col] -= 1.0
        sink_specs.append({
            "node_id": target["node_id"],
            "item_id": target_data.id,
            "col": sink_col,
            "mode": tgt_mode,
            "amount": target_data.amount,
        })

    # 步骤 2.5：识别溢流物品，扩展矩阵维度（白皮书 §7.2.2）
    # Void_ 端口 = 直接排空，不进入守恒约束，不分配溢流变量
    # 注意：必须在写入所有节点系数之后构建，否则无法检测 source/target 的正系数
    equality_items_set = set(request.equality_items)

    spill_items: List[str] = []
    spill_index: Dict[str, int] = {}
    for item_id in items:
        if is_void_name(item_id):
            continue
        row = item_rows[item_id]
        if item_id not in equality_items_set and bool(np.any(row > 1e-12)):
            spill_items.append(item_id)
            spill_index[item_id] = len(spill_items) - 1

    spill_count = len(spill_items)
    spill_start = total_vars
    total_vars += spill_count

    for item_id in items:
        item_rows[item_id] = np.append(item_rows[item_id], np.zeros(spill_count, dtype=float))
    for spill_item in spill_items:
        item_rows[spill_item][spill_start + spill_index[spill_item]] = -1.0

    _spill_m = 10000.0 * max(1, recipe_count)

    # 步骤 3：构建目标函数 c 与变量边界 bounds
    c = np.zeros(total_vars, dtype=float)
    bounds: List[tuple[float, Optional[float]]] = []
    for col, recipe in enumerate(recipe_nodes):
        recipe_data: RecipeNodeData = recipe["data"]
        recipe_mode = getattr(recipe_data, 'mode', None) or ('auto' if recipe_data.is_auto else 'limit')
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

    for i in range(spill_count):
        c[spill_start + i] = _spill_m
        bounds.append((0, None))

    # 步骤 4：约束构建（白皮书 §7.2.3）
    # Void_ 端口无约束 — 直接排空，不参与物质守恒
    A_eq_rows: List[List[float]] = []
    b_eq: List[float] = []
    A_ub_rows: List[List[float]] = []
    b_ub: List[float] = []

    for item_id in items:
        row = item_rows[item_id]
        if is_void_name(item_id):
            continue
        if item_id in equality_items_set:
            A_eq_rows.append(row.tolist())
            b_eq.append(0.0)
        elif item_id in spill_index:
            A_eq_rows.append(row.tolist())
            b_eq.append(0.0)

    A_eq = np.array(A_eq_rows, dtype=float) if A_eq_rows else None
    b_eq_arr = np.array(b_eq, dtype=float) if b_eq else None
    A_ub = np.array(A_ub_rows, dtype=float) if A_ub_rows else None
    b_ub_arr = np.array(b_ub, dtype=float) if b_ub else None

    # ── DEBUG: 写矩阵诊断到文件 ──
    import json as _json
    from datetime import datetime as _datetime
    from pathlib import Path as _Path
    _debug = {
        "time": _datetime.now().isoformat(timespec="seconds"),
        "nodes": len(recipe_nodes) + len(source_nodes) + len(target_nodes),
        "recipes": [r["node_id"] for r in recipe_nodes],
        "sources": [s["node_id"] for s in source_nodes],
        "targets": [t["node_id"] for t in target_nodes],
        "total_vars": total_vars,
        "spill_count": spill_count,
        "spill_m": _spill_m,
        "spill_items": spill_items,
        "items": items,
        "edges": [(e.source, e.target, e.sourceHandle, e.targetHandle) for e in edges],
        "equality_items": list(equality_items_set),
        "vars": [],
        "constraints": [],
    }
    for recipe in recipe_nodes:
        rd: RecipeNodeData = recipe["data"]
        _debug["vars"].append({
            "type": "recipe", "node_id": recipe["node_id"],
            "mode": getattr(rd, 'mode', None) or ('auto' if rd.is_auto else 'limit'),
            "manual_machines": rd.manual_machines,
        })
    for source in source_nodes:
        sd: SourceNodeData = source["data"]
        _debug["vars"].append({
            "type": "source", "node_id": source["node_id"], "id": sd.id,
            "mode": getattr(sd, 'mode', None) or ('infinite' if sd.is_auto else 'limit'),
            "amount": sd.amount,
        })
    for target in target_nodes:
        td: TargetNodeData = target["data"]
        _debug["vars"].append({
            "type": "target", "node_id": target["node_id"], "id": td.id,
            "mode": getattr(td, 'mode', None) or ('maximize' if td.is_auto else 'demand'),
            "amount": td.amount,
        })
    for item_id in items:
        row = item_rows[item_id]
        _debug["constraints"].append({
            "item": item_id,
            "row": [round(float(v), 6) for v in row.tolist()],
            "equality": item_id in equality_items_set,
            "spill": item_id in spill_index,
            "has_pos": bool(np.any(row > 1e-12)),
        })
    _log_dir = _Path(__file__).resolve().parent / "logs"
    _log_dir.mkdir(exist_ok=True)
    _ts = _datetime.now().strftime("%Y%m%d_%H%M%S")
    _log_path = _log_dir / f"debug_{_ts}.json"
    _log_path.write_text(_json.dumps(_debug, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[DEBUG] written to {_log_path}")

    # 步骤 5：调用 SciPy 求解
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
            "message": "发现最大化节点，但产线缺乏物理瓶颈。请为任意上游机器或输入源设定'产能上限'！",
        }
    if not res.success:
        return {
            "status": "infeasible",
            "message": res.message,
        }

    # 步骤 6：格式化结果并返回
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
            "actual_amount": actual_value,
        }

    for sink_spec in sink_specs:
        raw_value = float(res.x[sink_spec["col"]])
        actual_value = 0.0 if abs(raw_value) <= 1e-6 else raw_value
        node_results[sink_spec["node_id"]] = {
            "actual_amount": actual_value,
        }

    # ── 全量矩阵回代清算 ──
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
    """与 /api/calculate 走完全相同的逻辑，但不求解，只返回诊断信息。"""
    import json

    nodes = request.nodes
    edges = request.edges

    def parse_model(model_cls, payload):
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

    # 写入所有节点的物品系数（必须在构建 spill 之前完成）
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
        src_mode = getattr(source_data, 'mode', None) or ('infinite' if source_data.is_auto else 'limit')
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
        tgt_mode = getattr(target_data, 'mode', None) or ('maximize' if target_data.is_auto else 'demand')
        item_rows[target_data.id][sink_col] -= 1.0
        sink_specs.append({
            "node_id": target["node_id"],
            "item_id": target_data.id,
            "col": sink_col,
            "mode": tgt_mode,
            "amount": target_data.amount,
        })

    # 步骤 2.5：识别溢流物品（§7.2.2）
    # Void_ 端口 = 直接排空，不进入守恒约束，不分配溢流变量
    # 注意：必须在写入所有节点系数之后构建，否则无法检测 source/target 的正系数
    equality_items_set = set(request.equality_items)
    spill_items2: List[str] = []
    spill_index2: Dict[str, int] = {}
    for item_id in items:
        if is_void_name(item_id):
            continue
        row = item_rows[item_id]
        if item_id not in equality_items_set and bool(np.any(row > 1e-12)):
            spill_items2.append(item_id)
            spill_index2[item_id] = len(spill_items2) - 1

    spill_count2 = len(spill_items2)
    spill_start2 = total_vars
    total_vars += spill_count2

    for item_id in items:
        item_rows[item_id] = np.append(item_rows[item_id], np.zeros(spill_count2, dtype=float))
    for spill_item in spill_items2:
        item_rows[spill_item][spill_start2 + spill_index2[spill_item]] = -1.0

    _spill_m2 = 10000.0 * max(1, recipe_count)

    c = np.zeros(total_vars, dtype=float)
    bounds: List[tuple[float, Optional[float]]] = []
    for col, recipe in enumerate(recipe_nodes):
        recipe_data: RecipeNodeData = recipe["data"]
        recipe_mode = getattr(recipe_data, 'mode', None) or ('auto' if recipe_data.is_auto else 'limit')
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

    for i in range(spill_count2):
        c[spill_start2 + i] = _spill_m2
        bounds.append((0, None))

    # ── 约束构建 ──
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
            "in_equality": item_id in equality_items_set,
            "has_positive": bool(np.any(row > 1e-12)),
            "has_negative": bool(np.any(row < -1e-12)),
        }
        if item_id in equality_items_set:
            A_eq_rows.append(row.tolist())
            b_eq.append(0.0)
            detail["constraint"] = "hard_eq (Target)"
        elif is_void_name(item_id):
            detail["constraint"] = "skip (Void — 直接排空)"
        elif item_id in spill_index2:
            A_eq_rows.append(row.tolist())
            b_eq.append(0.0)
            detail["constraint"] = f"soft_eq + spill (M={_spill_m2})"
        else:
            detail["constraint"] = "skip (无正系数)"
        constraint_details.append(detail)

    # ── 变量列名 ──
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
        "equality_items_received": request.equality_items,
        "items": items,
        "constraint_details": constraint_details,
        "equality_rows_count": len(A_eq_rows),
        "inequality_rows_count": len(A_ub_rows),
        "b_eq": b_eq,
        "b_ub": b_ub,
    }
