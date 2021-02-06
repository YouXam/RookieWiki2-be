const bodyParse = require('koa-body')
const jwt = require('koa-jwt')
const logger = require('./logger')

module.exports = function (koa, config, db) {
    // 获取 ip
    koa.use(async (ctx, next) => {
        ctx.ip = ctx.ips.length > 0 ? ctx.ips[ctx.ips.length - 1] : ctx.ip
        await next()
    })

    // 日志
    koa.use(logger())

    // 解析 POST 请求
    koa.use(bodyParse({ multipart: true }))

    // 添加 json 方法
    koa.use(async (ctx, next) => {
        ctx.json = json => {
            ctx.body = JSON.stringify(json)
            ctx.type = 'application/json'
            ctx.status = json.code || 200
        }
        await next()
    })

    // 将错误转为 json 格式
    koa.use(async (ctx, next) => {
        await next()
        if (ctx.status > 200 && ctx.type != 'application/json') {
            ctx.json({ code: ctx.status, msg: ctx.message })
        }
    })

    // 检测是否登录 & 解码 token 
    // 如果登录, 信息存储在 ctx.state.user, 否则为 undefined
    koa.use(jwt({ secret: config.secret, passthrough: true }))
    
    // 获取用户权限
    koa.use(async (ctx, next) => {
        if (!ctx.state.user) ctx.state.user = {}
        const user = await db.collection('users').findOne({ username: ctx.state.user.username })
        ctx.state.user.permission =  (user && user.permission) || 1
        await next()
    })
}