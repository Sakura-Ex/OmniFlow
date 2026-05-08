import math
import logging
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError
from scipy.optimize import linprog

logger = logging.getLogger("omniflow")

# =====================================================================
# 1. 基础环境与 FastAPI 实例初始化
# =====================================================================
app = FastAPI(
    title="OmniFlow Backend",
    description="Backend calculation engine for the production line calculator",
    version="0.1.0"
)

# 配置 CORS，允许前端跨域访问
# 允许来自 Vite 默认本地开发端口的请求，线上环境需根据实际域名配置
origins = [
    "http://localhost:5173",
    # "*", # 如果你需要无条件放行全局，可以取消注释此行
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
    for col, recipe in enumerate(recipe_nodes):
        recipe_data: RecipeNodeData = recipe["data"]
        for item_id, rate in recipe_data.outputs.items():
            item_rows[item_id][col] += rate
        for item_id, rate in recipe_data.inputs.items():
            item_rows[item_id][col] -= rate

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

    source_specs: List[Dict[str, Any]] = []
    for offset, source in enumerate(source_nodes):
        source_data: SourceNodeData = source["data"]
        source_col = source_start + offset
        src_mode = getattr(source_data, 'mode', None) or ('infinite' if source_data.is_auto else 'limit')
        item_rows[source_data.id][source_col] += 1.0
        upper_bound = max(0.0, float(source_data.amount)) if src_mode == 'limit' else None
        bounds.append((0, upper_bound))
        source_specs.append({
            "node_id": source["node_id"],
            "item_id": source_data.id,
            "col": source_col,
        })

    sink_specs: List[Dict[str, Any]] = []
    for offset, target in enumerate(target_nodes):
        target_data: TargetNodeData = target["data"]
        sink_col = sink_start + offset
        tgt_mode = getattr(target_data, 'mode', None) or ('maximize' if target_data.is_auto else 'demand')
        demand_amt = max(0.0, float(target_data.amount))
        item_rows[target_data.id][sink_col] -= 1.0
        if tgt_mode == 'demand':
            c[sink_col] = 0.0
            bounds.append((demand_amt, None))
        elif tgt_mode == 'maximize':
            c[sink_col] = -10000.0
            bounds.append((0, None))
        else:
            c[sink_col] = 0.001
            bounds.append((0, None))

        sink_specs.append({
            "node_id": target["node_id"],
            "item_id": target_data.id,
            "col": sink_col,
        })

    # 步骤 4：有下游连线（或 Target）的物品严格守恒，其余允许隐式溢出
    A_eq_rows: List[List[float]] = []
    b_eq: List[float] = []
    A_ub_rows: List[List[float]] = []
    b_ub: List[float] = []
    equality_items = set(request.equality_items)

    for item_id in items:
        row = item_rows[item_id]
        if item_id in equality_items:
            # 有下游连线：严格守恒等式（产出 + 源输入 - 消耗 - 靶输出 == 0）
            A_eq_rows.append(row.tolist())
            b_eq.append(0.0)
        else:
            # 无下游连线：只有当该物品存在生产来源（正系数列）时才施加"净流量 >= 0"约束
            # 若 row 全为 0 或全负（纯消耗、无 SourceNode 也无配方产出），则视为隐式无限供给，跳过约束
            if bool(np.any(row > 1e-12)):
                A_ub_rows.append((-row).tolist())
                b_ub.append(0.0)

    A_eq = np.array(A_eq_rows, dtype=float) if A_eq_rows else None
    b_eq_arr = np.array(b_eq, dtype=float) if b_eq else None
    A_ub = np.array(A_ub_rows, dtype=float) if A_ub_rows else None
    b_ub_arr = np.array(b_ub, dtype=float) if b_ub else None

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
