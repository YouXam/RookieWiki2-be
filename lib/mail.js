const config = require('../config')
const nodemailer = require('nodemailer')
async function sendEmail(to, subject, html) {
    let transporter = nodemailer.createTransport(config.email)
    const res = await transporter.sendMail({
        from: `"RookieWiki" <${config.email.auth.user}>`,
        to,
        subject,
        html
    })
    console.log(res)
}
module.exports = {
    verify: async function (to, user, uuid) {
        const html = `您好, ${user}<br/>
请点击<a href="${config.base}/verify?token=${uuid}">此链接</a>验证您在 <a href="${config.base}">RookieWiki</a> 的邮箱地址。<br/><br/>
如果您没有注册过 RookieWiki 的账号, 请忽略这封邮件.
`
        await sendEmail(to, '验证你的邮箱', html)
    },
    find: async function (to, user, uuid) {
        const html = `您好, ${user}<br/>
请点击<a href="${config.base}/reset?token=${uuid}">此链接</a>重置您在 <a href="${config.base}">RookieWiki</a> 的密码。<br/><br/>
如果您没有注册过 RookieWiki 的账号, 请忽略这封邮件.
`
        await sendEmail(to, '重置密码', html)
    }
}