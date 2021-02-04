const Router = require('koa-router')
const jwt = require('koa-jwt')
const jsonwebtoken = require('jsonwebtoken')

const app = new Router()

// eslint-disable-next-line no-unused-vars
module.exports = function(koa, config, db) {
    // 未登录时返回错误信息
    app.use((ctx, next) => {
        return next().catch((err) => {
            if (err.status == 401) {
                ctx.status = 401
                ctx.json({ code: 401, msg: 'Unauthorized'})
            } else {
                throw err
            }
        })
    })
    // 检测是否登录 & 解码 token
    app.use(jwt({ secret: config.secret }))
    app.use(async (ctx, next) => {
        ctx.state.user = jsonwebtoken.decode(ctx.request.headers.authorization.split(' ')[1])
        await next()
    })


    app.get('/api/userinfo', async ctx => {
        ctx.json({ code: 200, data: ctx.state.user })
    })

    koa.use(app.routes())
}