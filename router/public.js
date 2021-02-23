const Router = require('koa-router')
const jwt = require('jsonwebtoken')
const app = new Router()
const uuid = require('uuid')
const { find } = require('../lib/mail')
const { getParams } = require('../lib/tools')

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
        const id = getParams(ctx, '找不到文章')
        if (!id) return
        const article = await db.collection('articles').findOne({ _id: id, visibility: { $lte: ctx.state.user.permission } })
        if (article) ctx.json({ code: 200, article })
        else ctx.json({ code: 404, msg: '找不到文章' })
    })
    
    // 获取文章历史记录
    app.get('/api/article/:id/history', async ctx => {
        const id = getParams(ctx, '找不到历史记录')
        if (!id) return
        if (ctx.query.num) {
            const history = await db.collection('history').findOne({ belong: id, num: parseInt(ctx.query.num)})
            if (history && history.history_visibility <= ctx.state.user.permission) ctx.json({ code: 200, history })
            else ctx.json({ code: 404, msg: '找不到历史记录' })
            return
        }
        const article = await db.collection('articles').findOne({ _id: id }, { projection: { visibility: 1 }})
        let page = parseInt(ctx.query.page) || 1
        page = page < 1 ? 1 : page
        const query = db.collection('history').find({ belong: id, history_visibility: { $lte: ctx.state.user.permission } }, { projection: { data: 0 }})
        const histories = await query.sort({ date: -1 }).skip((page - 1) * config.history_size).limit(config.history_size).toArray()
        const total = await query.count()
        if (article && article.visibility <= ctx.state.user.permission) ctx.json({ code: 200, histories, total, size: config.history_size })
        else ctx.json({ code: 404, msg: '找不到历史记录' })
    })

    // 获取历史记录详细信息
    app.get('/api/article/:id/history/:hid', async ctx => {
        const hid = getParams(ctx, '找不到历史记录', 'hid'), aid = getParams(ctx, '找不到文章')
        if (!hid || !aid) return
        const article = await db.collection('articles').findOne({ _id: aid }, { projection: { visibility: 1 }})
        if (!article) return ctx.json({ code: 404, msg: '找不到文章' })
        const history = await db.collection('history').findOne({ _id: hid, belong: aid })
        if (history && article.visibility <= ctx.state.user.permission && history.history_visibility <= ctx.state.user.permission) ctx.json({ code: 200, data: history })
        else ctx.json({ code: 404, msg: '找不到历史记录' })
    })

    // 登录
    app.post('/api/login', async ctx => {
        const username = ctx.request.body.username
        const password = ctx.request.body.password
        if (!username || !password) return ctx.json({ code: 400, msg: '参数不足' })
        const person = await db.collection('users').findOne({ $or: [ { username }, { email: username }] })
        if (person && person.password === password) {
            const token = jwt.sign({ username: person.username }, config.secret, { expiresIn: config.expires })
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
            await db.collection('users').insertOne({ username, password, email, permission: 1, verified: false })
            // 注册之后直接返回 token
            const token = jwt.sign({ username }, config.secret, { expiresIn: config.expires })
            ctx.json({ code: 200, msg: '注册成功', token })
        }
    })

    // 验证邮箱
    app.get('/api/verify', async ctx => {
        if (!ctx.query.token) return ctx.json({ code: 400, msg: '缺少token' })
        const res = await db.collection('verify').findOne({ uuid: ctx.query.token })
        if (res && (new Date()) - res.date <= 15 * 60 * 1000) {
            ctx.json({ code: 200, msg: '激活成功' })
            await db.collection('users').updateOne({ _id: res.user }, { $set: { verified: true }})
            await db.collection('verify').deleteOne({ uuid: ctx.query.token })
        } else {
            if (res) await db.collection('verify').deleteOne({ uuid: ctx.query.token })
            ctx.json({ code: 400, msg: '无法验证, 可能是已过期' })
        }
    })

    
    // 找回密码
    app.post('/api/find', async ctx => {
        const username = ctx.request.body.username
        if (!username) return ctx.json({ code: 400, msg: '参数不足' })
        const user = await db.collection('users').findOne({ $or: [ { username }, { email: username }] })
        if (!user) return ctx.json({ code: 404, msg: '找不到此用户' })
        if (!user.last_find || (new Date() - new Date(user.last_find)) >= 5 * 60 * 1000) {
            const id = uuid.v4()
            await db.collection('reset').insertOne({ user: user._id, date: new Date(), uuid: id })
            await find(user.email, user.username, id)
            const now = new Date()
            await db.collection('users').updateOne({ _id: user._id }, { $set: { last_find: now }})
            ctx.json({ code: 200, msg: '邮件已发送, 15分钟内有效, 请注意检查垃圾邮件', time: now })
        } else ctx.json({ code: 401, msg: '请等待一段时间再重试', time: user.last_find })
    })
    

    // 重置密码
    app.post('/api/reset', async ctx => {
        const token = ctx.request.body.token
        const password = ctx.request.body.password
        if (!token || !password) return ctx.json({ code: 400, msg: '参数不足' })
        const res = await db.collection('reset').findOne({ uuid: token })
        if (res && (new Date()) - res.date <= 15 * 60 * 1000) {
            ctx.json({ code: 200, msg: '重置成功' })
            await db.collection('users').updateOne({ _id: res.user }, { $set: { password }})
            await db.collection('reset').deleteOne({ uuid: token })
        } else {
            if (res) await db.collection('reset').deleteOne({ uuid: token })
            ctx.json({ code: 400, msg: '无法重置密码, 可能是已过期' })
        }
    })

    koa.use(app.routes())
}