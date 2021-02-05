const Router = require('koa-router')
const app = new Router()
const mongodb = require('mongodb')
const ObjectId = mongodb.ObjectId

const tools = require('../lib/tools')

// eslint-disable-next-line no-unused-vars
module.exports = function (koa, config, db) {
    // 未登录时返回错误信息
    app.use(async (ctx, next) => {
        if (ctx.state.user) await next()
        else ctx.json({ code: 401, msg: '未登录' })
    })

    // 获取用户信息
    app.get('/api/userinfo', async ctx => {
        const user = await db.collection('users').findOne({ username: ctx.state.user.username }, { projection: { password: 0 } })
        ctx.json({ code: 200, data: user })
    })

    // 新建文章
    // TODO 将编辑记录插入文章对象中
    // TODO 将编辑记录插入用户对象中
    app.post('/api/article/', async ctx => {
        const title = ctx.request.body.title
        const content = ctx.request.body.content
        const author = ctx.state.user.username
        if (!title || !content || !author) return ctx.json({ code: 400, msg: '参数不足' })
        const article = await db.collection('articles').insertOne({ title, content, visibility: 1 })
        ctx.json({ code: 200, article: article.ops })
    })

    // 获取用户权限
    app.use(async (ctx, next) => {
        ctx.state.permission = await tools.get_permission(ctx, db)
        await next()
    })

    // 修改文章内容: 可见性, 标题和内容
    // TODO 修改标题和内容 - 历史记录
    // TODO 将编辑记录插入文章对象中
    // TODO 将编辑记录插入用户对象中
    app.post('/api/article/:id', async ctx => {
        const article = await db.collection('articles').findOne({ _id: ObjectId(ctx.params.id) })
        if (!article || article.visibility > ctx.state.permission) return ctx.json({ code: 404, msg: '找不到此文章'})
        const update = { $set: {} }
        if (ctx.request.body.visibility) {
            if (ctx.request.body.visibility <= ctx.state.permission) update.$set.visibility = parseInt(ctx.request.body.visibility)
            else return ctx.json({ code: 400, msg: '权限不足' })
        }
        if (Object.keys(update.$set).length) {
            await db.collection('articles').updateOne({ _id: ObjectId(ctx.params.id) }, update)
            ctx.json({ code: 200, msg: '修改成功' })
        } else ctx.json({ code: 200, msg: '没有修改' })
    })

    // 检查普通管理员权限
    app.use(async (ctx, next) => {
        if (ctx.state.permission < 2) return ctx.json({ code: 401, msg: '权限不足' })
        await next()
    })

    // 检查超级管理员权限
    app.use(async (ctx, next) => {
        if (ctx.state.permission < 3) return ctx.json({ code: 401, msg: '权限不足' })
        await next()
    })

    koa.use(app.routes())
}