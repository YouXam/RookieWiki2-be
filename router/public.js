const Router = require('koa-router')
const jwt = require('jsonwebtoken')
const app = new Router()
const mongodb = require('mongodb')
const ObjectId = mongodb.ObjectId


module.exports = function (koa, config, db) {
    app.get('/api/navigation', async ctx => {
        ctx.json({ code: 200, data: config.navigation })
    })

    app.get('/api/home', async ctx => {
        ctx.json({ code: 200, data: config.home })
    })

    // 获取文章列表
    app.get('/api/articles', async ctx => {
        let size = parseInt(ctx.query.size) || 20, page = parseInt(ctx.query.page) || 1
        size = size < 1 ? 1 : size > 50 ? 50 : size
        page = page < 1 ? 1 : page
        const args = ctx.query.search ? {
            $and: [
                {
                    visibility: { $lte: ctx.state.user.permission }
                },
                {
                    $or: [
                        { title: { $regex: ctx.query.search, $options: '$i' } },
                        { content: { $regex: ctx.query.search, $options: '$i' } },
                    ]
                }
            ]
        } : { visibility: { $lte: ctx.state.user.permission } }
        const query = db.collection('articles').find(args)
        const articles = await query.sort({ _id: -1 }).skip((page - 1) * size).limit(size).toArray()
        const total = await query.count()
        ctx.json({ code: 200, articles, total, size })
    })

    // 获取文章
    app.get('/api/article/:id', async ctx => {
        let id
        try {
            id = ObjectId(ctx.params.id)
        } catch (err) {
            return ctx.json({ code: 404, msg: '找不到文章'})
        }
        const article = await db.collection('articles').findOne({ _id: id, visibility: { $lte: ctx.state.user.permission } })
        if (article) ctx.json({ code: 200, article })
        else ctx.json({ code: 404, msg: '找不到文章' })
    })
    
    // 获取文章历史记录
    app.get('/api/article/:id/history', async ctx => {
        const article = await db.collection('articles').findOne({ _id: ObjectId(ctx.params.id)}, { projection: { visibility: 1 }})
        let page = parseInt(ctx.query.page) || 1
        page = page < 1 ? 1 : page
        const query = db.collection('history').find({ belong: ObjectId(ctx.params.id), history_visibility: { $lte: ctx.state.user.permission } })
        const histories = await query.sort({ date: -1 }).skip((page - 1) * config.history_size).limit(config.history_size).toArray()
        const total = await query.count()
        if (article.visibility <= ctx.state.user.permission) ctx.json({ code: 200, histories, total, size: config.history_size })
        else ctx.json({ code: 404, msg: '找不到历史记录' })
    })

    // 获取历史记录详细信息
    app.get('/api/article/:id/history/:history_id', async ctx => {
        const article = await db.collection('articles').findOne({ _id: ObjectId(ctx.params.id)}, { projection: { visibility: 1 }})
        const history = await db.collection('history').findOne({ _id: ObjectId(ctx.params.history_id) })
        if (history.belong == ctx.params.id && article.visibility <= ctx.state.user.permission) ctx.json({ code: 200, data: history })
        else ctx.json({ code: 404, msg: '找不到历史记录' })
    })

    // 登录
    app.post('/api/login', async ctx => {
        const username = ctx.request.body.username
        const password = ctx.request.body.password
        if (!username || !password) return ctx.json({ code: 400, msg: '参数不足' })
        const person = await db.collection('users').findOne({ $or: [ { username }, { email: username }] })
        console.log(person)
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
        const username_rule = new RegExp('^[^+ /?$#&=]{1,30}$')
        const email_rule = new RegExp('^.+@.+\\..+$')
        if (!username_rule.test(username) || !email_rule.test(email))
            return ctx.json({ code: 400, msg: '参数不合法' })
        if (await db.collection('users').findOne({ username })) ctx.json({ code: 400, msg: '用户名已被使用' })
        else if (await db.collection('users').findOne({ email })) ctx.json({ code: 400, msg: '邮箱已被注册' })
        else {
            await db.collection('users').insertOne({ username, password, email, permission: 1 })
            // 注册之后直接返回 token
            const token = jwt.sign({ username }, config.secret, { expiresIn: config.expires })
            ctx.json({ code: 200, msg: '注册成功', token })
        }
    })

    koa.use(app.routes())
}