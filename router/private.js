const Router = require('koa-router')
const app = new Router()
const mongodb = require('mongodb')
const ObjectId = mongodb.ObjectId

// eslint-disable-next-line no-unused-vars
module.exports = function (koa, config, db) {
    // 未登录时返回错误信息
    app.use(async (ctx, next) => {
        if (ctx.state.user) await next()
        else ctx.json({ code: 401, msg: '未登录' })
    })

    // 新建文章
    app.post('/api/article/', async ctx => {
        const title = ctx.request.body.title
        const content = ctx.request.body.content
        const author = ctx.state.user.username
        if (!title || !content || !author) return ctx.json({ code: 400, msg: '参数不足' })
        const res = await db.collection('articles').insertOne({ title, content, visibility: 1, history_total: 1 })
        await db.collection('history').insertOne({
            num: 1,
            user: ctx.state.user.username,
            date: new Date(), 
            belong: res.ops[0]._id,
            data: { title, content, visibility: 1 },
            state: { title: true, content: true, visibility: true },
            history_visibility: 1
        })
        ctx.json({ code: 200, article: res.ops[0] })
    })

    // 修改文章内容: 可见性, 标题和内容
    app.post('/api/article/:id', async ctx => {
        const article = await db.collection('articles').findOne({ _id: ObjectId(ctx.params.id) })
        if (!article || article.visibility > ctx.state.user.permission) return ctx.json({ code: 404, msg: '找不到此文章'})
        const update = { $set: {} }
        const history = {
            belong: article._id,
            user: ctx.state.user.username, 
            date: new Date(), 
            data: {
                title: article.title,
                content: article.content,
                visibility: article.visibility
            },
            state: {
                title: false,
                content: false,
                visibility: false,
            },
            history_visibility: 1
        }
        if (ctx.request.body.visibility) {
            // 检查修改权限
            if (ctx.request.body.visibility <= ctx.state.user.permission) {
                history.data.visibility = update.$set.visibility = parseInt(ctx.request.body.visibility)
                history.state.visibility = true
            } else return ctx.json({ code: 400, msg: '权限不足' })
        }
        if (ctx.request.body.title) {
            history.data.title = update.$set.title = ctx.request.body.title
            history.state.title = true
        }
        if (ctx.request.body.content) {
            history.data.content = update.$set.content = ctx.request.body.content
            history.state.content = true
        }
        if (Object.keys(update.$set).length) {
            history.num = update.$set.history_total = article.history_total + 1
            await db.collection('articles').updateOne({ _id: ObjectId(ctx.params.id) }, update)
            await db.collection('history').insertOne(history)
            ctx.json({ code: 200, msg: '修改成功' })
        } else ctx.json({ code: 200, msg: '没有修改' })
    })

    
    // 获取用户信息
    app.get('/api/user/:username', async ctx => {
        const user = await db.collection('users').findOne({ username: ctx.params.username }, { projection: { password: 0 } })
        ctx.json({ code: 200, data: user })
    })

    // 检查普通管理员权限
    app.use(async (ctx, next) => {
        if (ctx.state.user.permission < 2) return ctx.json({ code: 401, msg: '权限不足' })
        await next()
    })


    // 检查超级管理员权限
    app.use(async (ctx, next) => {
        if (ctx.state.user.permission < 3) return ctx.json({ code: 401, msg: '权限不足' })
        await next()
    })

    koa.use(app.routes())
}