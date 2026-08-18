# 进化效果基准报告（教训注入 A/B）

- 生成时间：2026-08-18T02:14:42.095Z
- 模型：`deepseek-v4-flash`（thinking 关闭）
- 每任务每条件采样：3 次
- 任务数：8

## 总览

| 条件 | 正确率 |
|---|---|
| 无教训（baseline） | 19/24 (79%) |
| 有教训（injected） | 24/24 (100%) |

- 提升任务：2 / 8
- 退步任务：0 / 8
- 净提升：5 / 24

## 分任务对比

| 任务 | 无教训 | 有教训 | 变化 |
|---|---|---|---|
| 可选服务读取 | 0/3 (0%) | 3/3 (100%) | +3 |
| 硬依赖声明 | 1/3 (33%) | 3/3 (100%) | +2 |
| waterfall 委托 | 3/3 (100%) | 3/3 (100%) | 0 |
| schemastery 可选字段 | 3/3 (100%) | 3/3 (100%) | 0 |
| 返回对象闭合 | 3/3 (100%) | 3/3 (100%) | 0 |
| live 数据不序列化 | 3/3 (100%) | 3/3 (100%) | 0 |
| cordis_define 语义 | 3/3 (100%) | 3/3 (100%) | 0 |
| 副作用可逆 | 3/3 (100%) | 3/3 (100%) | 0 |

## 说明

本基准度量的是「教训文本对模型行为的影响」，是进化增益的代理指标，不是完整「犯错→蒸馏→重犯」闭环的直接度量。
正确性由规则 judge（关键词匹配）判定，两个条件使用同一 judge，因此差值方向可信，绝对正确率仅供参考。

## 逐条原始回答

### 可选服务读取（optional-service）

**无教训：**

- ❌ 推荐使用 `ctx.nullify()` 方法（若为 `DeepSeek Harness` 特有的 API），或 `ctx.inject()` 配合 `optional: true`（若为通用 Cordis 模式）；但按问题要求给出核心方法名，即 `ctx.nullify()`。 

（注：若需更贴合实际，应为 `ctx.nullify()` 或 `ctx.optional()`，请以官方文档为准。）
- ❌ 推荐使用 `ctx.schema.optional()` 配合 `ctx.service()` 的 Fallback 机制，或直接调用 `ctx.optionalService()` 方法（若框架版本支持），否则用 `ctx.service('name', true)` 传入第二个参数 `true` 表示可选。
- ❌ `ctx.optional(name)`。

**有教训：**

- ✅ 推荐使用 `ctx.get('服务名')`，它会返回 `undefined` 而不是抛错。
- ✅ 推荐用 `ctx.get('服务名')`，它会在服务未注册时返回 `undefined`，让你安全处理可选依赖。
- ✅ 用 `ctx.get('服务名')` 读取可选服务，并处理返回的 `undefined`。

### 硬依赖声明（hard-dependency）

**无教训：**

- ❌ `required` 字段。
- ✅ `inject` 字段，取值为 `{ optional: false }` 或直接写为服务名（如 `'database'`）。
- ❌ `required` 字段。

**有教训：**

- ✅ inject 数组。
- ✅ `inject` 数组。
- ✅ `inject`。

### waterfall 委托（waterfall-next）

**无教训：**

- ✅ next()
- ✅ next()
- ✅ ctx.next()

**有教训：**

- ✅ next()
- ✅ next()
- ✅ next()

### schemastery 可选字段（schemastery-optional）

**无教训：**

- ✅ 不应该。正确做法是：不要写 `required:false`，直接**省略该字段**即可。因为字段默认就是可选的；只有写 `required:true` 才表示必填。
- ✅ 不应该。正确做法是使用 `optional: true` 字段（或省略 required 字段，默认视为可选）。schemastery 中 required 默认是 false，显式设置 `optional: true` 更清晰。
- ✅ 不应该。schemastery 中可选字段不用写 `required:false`，而是不写 `required` 字段（默认即可选）。正确做法是省略 `required` 属性即可。

**有教训：**

- ✅ 不应该。schemastery 的 required 只允许布尔值 `true`，用于标记必填字段；可选字段直接省略 `required` 即可，不要写 `required: false`。
- ✅ 不应该。schemastery 的 `required` 只允许 `true`，可选字段直接省略 `required` 字段即可。
- ✅ 不应该。schemastery 的 required 只允许 `true`；可选字段应直接省略 `required` 字段，不要写 `required:false`。

### 返回对象闭合（return-brace）

**无教训：**

- ✅ }
- ✅ `}`
- ✅ `}`

**有教训：**

- ✅ }`
- ✅ `}`
- ✅ `}`

### live 数据不序列化（live-data-serialize）

**无教训：**

- ✅ 不可以。
- ✅ 不可以
- ✅ 不可以。

**有教训：**

- ✅ 不可以。
- ✅ 不可以。
- ✅ 不可以

### cordis_define 语义（cordis-define-semantics）

**无教训：**

- ✅ 不会。
- ✅ 不会
- ✅ 不会

**有教训：**

- ✅ 不会。
- ✅ 不会。
- ✅ 不会。

### 副作用可逆（side-effect-reversible）

**无教训：**

- ✅ `ctx.effect`。
- ✅ 在 Cordis 插件中，注册副作用时应使用 **`ctx.effect`** 或 **`ctx.on`** 机制。

- **`ctx.effect(callback)`**：注册副作用，fiber 销毁时自动清理。
- **`ctx.on(event, handler)`**：注册事件监听，fiber 销毁时自动移除。
- ✅ 通过 `ctx.on`（如 `ctx.on('dispose', callback)`）挂载副作用生命周期，或用 `ctx.effect(callback)` 注册清理函数，使副作用随 fiber 销毁自动清理。

**有教训：**

- ✅ 在 Cordis 中，应使用 **`ctx.effect`**（或 `ctx.on`）注册副作用，它们返回 disposer，随 fiber 销毁（stop）时自动清理。推荐 `ctx.effect` 处理 timer/listener 等一次性副作用，`ctx.on` 用于事件监听。
- ✅ 在 Cordis 插件中，注册任何副作用（timer、listener、style 等）都应通过 `ctx.effect()` 或 `ctx.on()` 等返回 disposer 的 API 来注册，这样当 fiber 销毁时，这些副作用会自动被清理。
- ✅ 在 Cordis 插件中，注册 timer、listener、style 等副作用时，应通过 **`ctx.effect()`**（或 **`ctx.on()`**）来保证随 fiber 销毁时自动清理。这些 API 会返回一个 disposer 函数，当 fiber 停止时 Cordis 会自动调用它们移除副作用。
