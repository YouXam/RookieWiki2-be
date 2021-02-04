const Router = require('koa-router')
const jwt = require('jsonwebtoken')
const app = new Router()

module.exports = function (koa, config, db) {

    // 登录
    app.post('/api/login', async ctx => {
        const username = ctx.request.body.username
        const password = ctx.request.body.password
        if (!username || !password) return ctx.json({ code: 400, msg: '参数不足'})
        const person = await db.collection('users').findOne({ username: username })
        if (person && person.password === password) {
            const token = jwt.sign({ username: username, email: person.email }, config.secret, { expiresIn:  config.expires })
            ctx.json({ code: 200, msg: '登录成功', token: token })
        } else
            ctx.json({ code: 401, msg: '登录失败' })
    })

    // 注册
    app.post('/api/register', async ctx => {
        const username = ctx.request.body.username
        const password = ctx.request.body.password
        const email = ctx.request.body.email
        if (!username || !password || !email) return ctx.json({ code: 400, msg: '参数不足'})
        const person = await db.collection('users').findOne({ username: username })
        if (person) ctx.json({ code: 400, msg: '用户名已被使用' })
        else {
            await db.collection('users').insertOne({ username: username, password: password, email: email })
            // 注册之后直接返回 token
            const token = jwt.sign({ username: username, email: email }, config.secret, { expiresIn:  config.expires })
            ctx.json({ code: 200, msg: '注册成功', token: token })
        }
    })

    koa.use(app.routes())
}