const Router = require('koa-router')
const jwt = require('jsonwebtoken')
const app = new Router()
const mongodb = require('mongodb')
const ObjectId = mongodb.ObjectId

const tools = require('../lib/tools')


module.exports = function (koa, config, db) {

    // 获取文章列表
    app.get('/api/articles', async ctx => {
        let size = parseInt(ctx.query.size) || 20, page = parseInt(ctx.query.page) || 1
        size = size < 1 ? 1 : size > 50 ? 50 : size
        page = page < 1 ? 1 : page
        const args = ctx.query.search ? {
            $and: [
                {
                    visibility: { $lte: await tools.get_permission(ctx, db) }
                },
                {
                    $or: [
                        { title: { $regex: ctx.query.search, $options: '$i'} },
                        { content: { $regex: ctx.query.search, $options: '$i'} },
                    ]
                }
            ]
        } : { visibility: { $lte: await tools.get_permission(ctx, db) } }
        const query = db.collection('articles').find(args)
        const articles = await query.skip((page - 1) * size).limit(size).toArray()
        const total = await query.count()
        ctx.json({ code: 200, articles, total })
    })

    // 获取文章
    app.get('/api/article/:id', async ctx => {
        const article = await db.collection('articles').findOne({ _id: ObjectId(ctx.params.id), visibility: { $lte: await tools.get_permission(ctx, db) } })
        if (article) ctx.json({ code: 200, article })
        else ctx.json({ code: 404, msg: 'Not Found' })
    })


    // 登录
    app.post('/api/login', async ctx => {
        const username = ctx.request.body.username
        const password = ctx.request.body.password
        if (!username || !password) return ctx.json({ code: 400, msg: '参数不足' })
        const person = await db.collection('users').findOne({ username })
        if (person && person.password === password) {
            const token = jwt.sign({ username }, config.secret, { expiresIn: config.expires })
            ctx.json({ code: 200, msg: '登录成功', token })
        } else
            ctx.json({ code: 401, msg: '登录失败' })
    })

    // 注册
    app.post('/api/register', async ctx => {
        const username = ctx.request.body.username
        const password = ctx.request.body.password
        const email = ctx.request.body.email
        if (!username || !password || !email) return ctx.json({ code: 400, msg: '参数不足' })
        const person = await db.collection('users').findOne({ username })
        if (person) ctx.json({ code: 400, msg: '用户名已被使用' })
        else {
            await db.collection('users').insertOne({ username, password, email, permission: 1 })
            // 注册之后直接返回 token
            const token = jwt.sign({ username }, config.secret, { expiresIn: config.expires })
            ctx.json({ code: 200, msg: '注册成功', token })
        }
    })

    koa.use(app.routes())
}