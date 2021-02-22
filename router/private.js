const Router = require('koa-router')
const uuid = require('uuid')
const { verify } = require('../lib/mail')
const app = new Router()
const { getParams } = require('../lib/tools')
// eslint-disable-next-line no-unused-vars
module.exports = function (koa, config, db) {
    // 未登录时返回错误信息
    app.use(async (ctx, next) => {
        if (ctx.state.user.permission <= 0) return ctx.json({ code: 401, msg: '您已被封禁' })
        if (ctx.state.user.username) await next()
        else ctx.json({ code: 401, msg: '未登录' })
    })

    // 新建文章
    app.post('/api/article/', async ctx => {
        const title = ctx.request.body.title
        const content = ctx.request.body.content
        const log = ctx.request.body.log
        const res = await db.collection('articles').insertOne({ title, content, visibility: 1, history_total: 1 })
        await db.collection('history').insertOne({
            num: 1,
            user: ctx.state.user.username,
            date: new Date(), 
            belong: res.ops[0]._id,
            data: { title, content, visibility: 1 },
            state: { title: true, content: true, visibility: true },
            history_visibility: 1,
            log
        })
        ctx.json({ code: 200, article: res.ops[0] })
    })

    // 修改文章内容: 可见性, 标题和内容
    app.post('/api/article/:id', async ctx => {
        const id = getParams(ctx, '找不到文章')
        if (!id) return
        const article = await db.collection('articles').findOne({ _id: id })
        if (!article || article.visibility > ctx.state.user.permission) return ctx.json({ code: 404, msg: '找不到此文章' })
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
            history_visibility: 1,
            log: ctx.request.body.log
        }
        if (ctx.request.body.visibility) {
            // 检查修改权限
            if (ctx.request.body.visibility <= ctx.state.user.permission) {
                history.data.visibility = update.$set.visibility = parseInt(ctx.request.body.visibility)
                history.state.visibility = true
            } else return ctx.json({ code: 400, msg: '权限不足' })
        }
        if (ctx.request.body.title !== undefined) {
            history.data.title = update.$set.title = ctx.request.body.title
            history.state.title = true
        }
        if (ctx.request.body.content !== undefined) {
            history.data.content = update.$set.content = ctx.request.body.content
            history.state.content = true
        }
        if (Object.keys(update.$set).length) {
            history.num = update.$set.history_total = article.history_total + 1
            await db.collection('articles').updateOne({ _id: id }, update)
            await db.collection('history').insertOne(history)
            ctx.json({ code: 200, msg: '修改成功' })
        } else ctx.json({ code: 400, msg: '没有修改' })
    })

    // 修改历史记录可见性
    app.post('/api/article/:aid/history/:hid', async ctx => {
        const hid = getParams(ctx, '找不到历史记录', 'hid'), aid = getParams(ctx, '找不到历史记录', 'aid')
        if (!hid || !aid) return
        if (!ctx.request.body.visibility) return ctx.json({ code: 400, msg: '参数不足'})
        const visibility = parseInt(ctx.request.body.visibility)
        if (!visibility || visibility > ctx.state.user.permission) return ctx.json({ code: 404, msg: '权限不足'})
        const res = await db.collection('history').findOne({ _id: hid, belong: aid })
        if (!res || res.history_visibility > ctx.state.user.permission) return ctx.json({ code: 404, msg: '找不到历史记录'})
        await db.collection('history').updateOne({ _id: hid, belong: aid }, { $set: { history_visibility: visibility }})
        ctx.json({ code: 200, msg: '修改成功' })
    })
    
    // 获取用户信息
    app.get('/api/user', async ctx => {
        const user = await db.collection('users').findOne({ username: ctx.state.user.username }, { projection: { password: 0 } })
        ctx.json({ code: 200, data: user })
    })
    app.get('/api/user/:username', async ctx => {
        const user = await db.collection('users').findOne({ username: ctx.params.username }, { projection: { password: 0 } })
        if (user) ctx.json({ code: 200, data: user })
        else ctx.json({ code: 404, msg: '找不到用户'})
    })

    // 激活邮件
    app.post('/api/active', async ctx => {
        if (ctx.state.user.verified) return ctx.json({ code: 400, msg: '已激活'})
        if (!ctx.state.user.last_active || (new Date() - new Date(ctx.state.user.last_active)) >= 5 * 60 * 1000) {
            const id = uuid.v4()
            await db.collection('verify').insertOne({ user: ctx.state.user._id, date: new Date(), uuid: id })
            await verify(ctx.state.user.email, ctx.state.user.username, id)
            const now = new Date()
            await db.collection('users').updateOne({ _id: ctx.state.user._id }, { $set: { last_active: now }})
            ctx.json({ code: 200, msg: '邮件已发送, 15分钟内有效', time: now })
        } else ctx.json({ code: 401, msg: '请等待一段时间再重试', time: ctx.state.user.last_active })
    })

    // 修改密码
    app.post('/api/update_password', async ctx => {
        if (!ctx.request.body.oldpassword || !ctx.request.body.newpassword) return ctx.json({ code: 400, msg: '参数不足' })
        if (ctx.request.body.oldpassword == ctx.state.user.password) {
            await db.collection('users').updateOne({ _id: ctx.state.user._id }, { $set: { password: ctx.request.body.newpassword }})
            ctx.json({ code: 200, msg: '修改成功' })
        } else ctx.json({ code: 400, msg: '原始密码错误' })
    })

    // 修改邮箱
    app.post('/api/update_email', async ctx => {
        const email = ctx.request.body.email
        if (!email) return ctx.json({ code: 400, msg: '参数不足' })
        if (await db.collection('users').findOne({ email })) return ctx.json({ code: 400, msg: '邮箱已被使用' })
        await db.collection('users').updateOne({ _id: ctx.state.user._id }, { $set: { email, verified: false }})
        await db.collection('verify').remove({ user: Object(ctx.state.user._id ) })
        ctx.json({ code: 200, msg: '修改成功' })
    })

    // 检查管理员权限
    app.use(async (ctx, next) => {
        if (ctx.state.user.permission < 2) return ctx.json({ code: 401, msg: '权限不足' })
        await next()
    })

    // 修改权限
    app.post('/api/update_permission', async ctx => {
        if (!ctx.request.body.uid || ctx.request.body.permission === undefined) return ctx.json({ code: 400, msg: '参数不足'})
        const permission = parseInt(ctx.request.body.permission)
        const person = await db.collection('users').findOne({ username: ctx.request.body.uid })
        if (permission >= ctx.state.user.permission || person.permission >= ctx.state.user.permission) return ctx.json({ code: 401, msg: '权限不足'})
        await db.collection('users').updateOne({ username: ctx.request.body.uid }, { $set: { permission }})
        ctx.json({ code: 200, msg: '修改成功' })
    })

    koa.use(app.routes())
}