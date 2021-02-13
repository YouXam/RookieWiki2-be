const bodyParse = require('koa-body')
const jwt = require('koa-jwt')
const logger = require('./logger')

module.exports = function (koa, config, db) {
    
    // 日志
    koa.use(logger())

    // 解析 POST 请求
    koa.use(bodyParse({ multipart: true }))

    // 检测是否登录 & 解码 token 
    // 如果登录, 信息存储在 ctx.state.user, 否则为 undefined
    koa.use(jwt({ secret: config.secret, passthrough: true }))
    
    koa.use(async (ctx, next) => {
        // 获取 ip
        ctx.ip = ctx.ips.length > 0 ? ctx.ips[ctx.ips.length - 1] : ctx.ip
        // 添加 json 方法
        ctx.json = json => {
            ctx.body = JSON.stringify(json)
            ctx.type = 'application/json'
            ctx.status = json.code || 200
        }
        // 获取用户权限
        if (!ctx.state.user) ctx.state.user = {}
        const user = await db.collection('users').findOne({ username: ctx.state.user.username })
        ctx.state.user.permission =  (user && user.permission) || 1
        try {
            await next()
        } catch (err) {
            console.log(err)
            ctx.json({ code: 500 })
        }

        // 跨域
        if (ctx.method === 'OPTIONS') ctx.status = 200
        ctx.append('Access-Control-Allow-Origin', '*')
        ctx.append('Access-Control-Allow-Methods', '*')
        ctx.append('Access-Control-Allow-Headers', '*')
    })
}