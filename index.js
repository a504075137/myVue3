const baseHandler = {
    get(target, key) {
        // const res = target[key]
        const res = Reflect.get(target, key)
        track(target, key) // 收集依赖
        return typeof res === 'object' ? reactive(res) : res
    },
    set(target, key, val) {
        const info = { oldValue: target[key], newValue: val }
        // target[key] = val
        const result = Reflect.set(target, key, val);
        //@todo 响应式去通知变化
        trigger(target, key, info)

        return result;
    }
}

function reactive(target) {
    const observed = new Proxy(target, baseHandler)
    // 返回代理后对象
    return observed
}




function effect(fn, options = {}) {
    // 数据变化的时候执行
    // 依赖函数收集，传递进来的就是依赖函数
    let e = createReactiveEffect(fn, options = {}) // 创建依赖对象
    e()
    return e
}
let effectStack = [] // 存储effect

function createReactiveEffect(fn, options) {
    // 构造固定格式的effect
    const effect = function effect(...args) {
        return run(effect, fn, args)
    }
    // effect的配置
    effect.deps = []
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



// 用一个巨大的map收集

// {
//     target1:{
//         key:[依赖的函数1，依赖的函数2]
//     },
//     target2:{
//         key:[依赖的函数1，依赖的函数2]
//     }
// }

let targetMap = new WeakMap()

function track(target, key) {
    // 收集依赖
    const effect = effectStack[effectStack.length - 1] // 获取最新的依赖函数
    if (effect) {
        let depMap = targetMap.get(target)
        if (depMap === undefined) {
            depMap = new Map()
            targetMap.set(target, depMap)
        }

        let dep = depMap.get(key)
        if (dep === undefined) {
            dep = new Set() // 用set顺便去重
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
    const effects = new Set() // 因为会有computed和普通的依赖，所以这里这样处理
    if (key) {
        let deps = depMap.get(key)
        deps.forEach(effect => {
            effects.add(effect)
        })
    }
    effects.forEach(effect => effect())
}