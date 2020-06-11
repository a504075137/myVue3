const baseHandler = {
    get(target, key) {
        // Reflect.get
        const res = target[key]

        track(target, key)
        return typeof res === 'object' ? reactive(res) : res
    },
    set(target, key, val) {
        const info = { oldValue: target[key], newValue: val }
        // Reflect.set
        target[key] = val
        //@todo 响应式去通知变化
        trigger(target, key, info)
    }
}

function reactive(target) {
    const observed = new Proxy(target, baseHandler)
    // 返回代理后对象
    return observed
}


function computed(fn) {
    //  特殊的effect
    const runner = effect(fn, { computed: true, lazy: true })
    return {
        effect: runner,
        get value() {
            return runner()
        }
    }
}


function effect(fn, options = {}) {
    // 依赖函数收集
    let e = createReactiveEffect(fn, options = {})
    // lazy是computed配置的
    if (!options.lazy) {
        // 不是懒执行
        e()
    }
    return e
}
function createReactiveEffect(fn, options) {
    // 构造固定格式的effect
    const effect = function effect(...args) {
        return run(effect, fn, args)
    }
    // effect的配置
    effect.deps = []
    effect.computed = options.computed
    effect.lazy = options.lazy
    return effect
}
function run(effect, fn, args) {
    // 执行effect
    // 取出effect执行
    if (effectStack.indexOf(effect) === -1) {
        try {
            effectStack.push(effect)
            return fn(...args) // 执行effect
        } finally {
            effectStack.pop() // effect执行完毕
        }
    }
}
let effectStack = [] // 存储effect
// 用一个巨大的map收集
let targetMap = new WeakMap()
function track(target, key) {
    // 收集依赖
    const effect = effectStack[effectStack.length - 1]
    if (effect) {
        let depMap = targetMap.get(target)
        if (depMap === undefined) {
            depMap = new Map()
            targetMap.set(target, depMap)
        }
        let dep = depMap.get(key)
        if (dep === undefined) {
            dep = new Set()
            depMap.set(key, dep)
        }
        // 容错
        if (!dep.has(effect)) {
            // 新增依赖
            // 双向存储 方便查找优化
            dep.add(effect)
            effect.deps.push(dep)
        }
    }
}
function trigger(target, key, info) {
    // 触发响应
    // 1.找到依赖
    const depMap = targetMap.get(target)
    if (!depMap) {
        return
    }
    // 分开，普通的effect和computed有一个优先级
    // effect先执行
    // computed可能会依赖普通effects
    const effects = new Set()
    const computedRunners = new Set()
    if (key) {
        let deps = depMap.get(key)
        deps.forEach(effect => {
            if (effect.computed) {
                computedRunners.add(effect)
            } else {
                effects.add(effect)

            }
        })
    }
    effects.forEach(effect => effect())
    computedRunners.forEach(computed => computed())
}