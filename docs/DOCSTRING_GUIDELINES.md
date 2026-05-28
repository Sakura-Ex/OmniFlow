# Docstring 编写指南

本文档说明 OmniFlow 项目的 docstring/JSDoc 编写规范。

## 规范总结

### Python (Google Style)

```python
def function_name(param1, param2):
    """One-line summary.
    
    Detailed description explaining what the function does, why it exists,
    and any important implementation details.
    
    Args:
        param1: Description of parameter 1
        param2: Description of parameter 2
    
    Returns:
        Description of return value
    
    Raises:
        ValueError: When this exception might be raised
    
    Example:
        >>> function_name(1, 2)
        3
    
    Note:
        Any additional notes or references (e.g., White Paper §7.3.4)
    """
```

### TypeScript (JSDoc)

```typescript
/**
 * One-line summary.
 * 
 * Detailed description explaining what the function/class/interface does,
 * why it exists, and any important implementation details.
 * 
 * @param param1 - Description of parameter 1
 * @param param2 - Description of parameter 2
 * @returns Description of return value
 * 
 * @example
 * ```typescript
 * functionName(1, 2) // returns 3
 * ```
 * 
 * @throws Error - When this exception might be thrown
 * 
 * @remarks
 * Any additional notes or references (e.g., White Paper §7.3.4)
 */
function functionName(param1: number, param2: number): number {
  return param1 + param2;
}
```

### Interface/Type 定义

```typescript
/**
 * Interface description.
 * 
 * Detailed explanation of what this interface represents and how it's used.
 */
export interface InterfaceName {
  /** Description of property 1 */
  property1: string;
  
  /** Description of property 2 */
  property2: number;
}
```

### Zustand Store

```typescript
/**
 * Store description.
 * 
 * Manages state for X feature, handling Y and Z operations.
 */
export type StoreName = {
  /** State property description */
  items: Record<string, ItemType>;
  
  /** Action description */
  setItem: (id: string, data: ItemType) => void;
  
  /** Action description */
  removeItem: (id: string) => void;
}
```

## 已完成文件

### Python 后端
- ✅ `backend/main.py` - 完整的 Google Style docstring

### TypeScript 前端 (待完成)
优先级划分:

#### P0 - 核心基础设施
- `src/features/calculation/payloadBuilder.ts`
- `src/features/calculation/topology.ts`
- `src/features/calculation/capEx.ts`
- `src/features/canvas/canvas.store.ts`
- `src/features/recipe/recipe.store.ts`
- `src/features/modifier/modifier.pipeline.ts`

#### P1 - 业务模块
- `src/features/resource-registry/registry.store.ts`
- `src/features/project/project.store.ts`
- `src/features/endpoint/endpointEditor.ts`

#### P2 - UI 组件和工具
- `src/common/utils/*.ts`
- `src/common/types/*.ts`
- `src/features/*/components/*.tsx`

## 检查工具

### Python
```bash
# 安装
pip install pydocstyle

# 检查
pydocstyle backend/
```

### TypeScript
```bash
# 已安装 eslint-plugin-jsdoc
# 运行 lint
npm run lint
```

## 关键原则

1. **英文编写** - 所有 docstring 使用英文
2. ** imperative mood** - 使用祈使句 (e.g., "Calculate", not "Calculates")
3. **完整参数说明** - 所有参数和返回值必须有描述
4. **示例代码** - 复杂函数应提供示例
5. **引用文档** - 涉及算法/设计时引用白皮书章节
6. **避免冗余** - 不要重复代码中显而易见的信息

## 参考资源

- [Google Python Style Guide - Comments and Docstrings](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)
- [JSDoc Documentation](https://jsdoc.app/)
- [eslint-plugin-jsdoc](https://github.com/gajus/eslint-plugin-jsdoc)
