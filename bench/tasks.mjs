/**
 * 基准任务集：一组有唯一正确答案的 DeepSeek Harness（DSH）二开知识点，
 * 每个知识点都对应一条本自进化系统已经蒸馏出的真实教训。
 *
 * 每条任务：
 *   - question: 让模型给出明确答案的提问
 *   - lesson:   对应教训的模型可见文本（模拟 lesson-injector 的被动注入）
 *   - expect:   答案应包含的任一关键词（命中即判对）
 *   - reject:   答案若包含任一关键词即判错（优先级高于 expect）
 */

export const TASKS = [
  {
    id: 'optional-service',
    title: '可选服务读取',
    question:
      '在 DeepSeek Harness 的 Cordis 插件里，要读取一个可能不存在的可选服务，'
      + '推荐用哪个 API？请一句话回答（提到具体方法名）。',
    lesson:
      '可选服务用 ctx.get(\'服务名\') 读取并处理 undefined；不要用 ctx.xxx 直接访问未声明的服务。',
    expect: ['ctx.get('],
    reject: [],
  },
  {
    id: 'hard-dependency',
    title: '硬依赖声明',
    question:
      '在 Cordis 插件里，一个服务是硬依赖（没有它插件必须等待）时，应该在哪里声明它？'
      + '请回答那个字段名。',
    lesson: '硬依赖要在返回插件对象的 inject 数组里声明，声明后才能用 ctx.xxx 访问。',
    expect: ['inject'],
    reject: [],
  },
  {
    id: 'waterfall-next',
    title: 'waterfall 委托',
    question:
      '在 Cordis 的 waterfall 监听器里，要委托给后续监听器继续处理，必须调用哪个函数？'
      + '只回答函数名。',
    lesson: 'waterfall 监听器必须调用 next() 委托；不调用会短路整个链。',
    expect: ['next'],
    reject: [],
  },
  {
    id: 'schemastery-optional',
    title: 'schemastery 可选字段',
    question:
      '用 schemastery 定义工具参数时，可选字段应该写 required:false 吗？'
      + '回答「应该」或「不应该」，并说明正确做法。',
    lesson: 'schemastery 的 required 只允许 true；可选字段直接省略 required，不要写 required:false。',
    expect: ['不应该', '省略'],
    reject: [],
  },
  {
    id: 'return-brace',
    title: '返回对象闭合',
    question:
      'Cordis 插件体以函数体包裹，apply 返回一个对象字面量时，函数体结尾用 `}` 还是 `});` 闭合？'
      + '只回答 `}` 或 `});`。',
    lesson: '插件体是函数体，返回对象只用 `}` 结束 return 对象，不要用 `});`。',
    expect: ['}'],
    reject: ['});'],
  },
  {
    id: 'live-data-serialize',
    title: 'live 数据不序列化',
    question:
      'Cordis 插件里，可以对 Service、Session 等内部 live 对象做 JSON.stringify 吗？'
      + '回答「可以」或「不可以」。',
    lesson: 'Service、Event、Session 是内部 live 数据，不要 JSON.stringify 或递归枚举；只读需要的叶子字段。',
    expect: ['不可以', '不能'],
    reject: [],
  },
  {
    id: 'cordis-define-semantics',
    title: 'cordis_define 语义',
    question:
      '调用 cordis_define 之后，插件代码会立即执行吗？回答「会」或「不会」。',
    lesson: 'cordis_define 只定义和呈现代码、不运行；要执行必须再调 cordis_run。',
    expect: ['不会'],
    reject: [],
  },
  {
    id: 'side-effect-reversible',
    title: '副作用可逆',
    question:
      'Cordis 插件里注册 timer、listener、style 等副作用时，应该通过什么机制保证随 fiber 销毁？'
      + '请回答 API 名（提到 ctx.effect 或 ctx.on）。',
    lesson: '每个副作用都要用 ctx.effect() 或 ctx.on() 等返回 disposer 的 API 注册，保证 stop 时被移除。',
    expect: ['ctx.effect', 'ctx.on', 'effect'],
    reject: [],
  },
]
