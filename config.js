module.exports = {
    // 运行端口
    port: 3000,
    // token 密钥
    secret: 'secret',
    // token 过期时间, 格式参见 https://github.com/vercel/ms
    expires: '7d',
    navigation: [
        // {
        //     text: '帮助',
        //     to: '/help',
        //     icon: 'mdi-help'
        // },
        // {
        //     text: '功能',
        //     to: '/function',
        //     icon: 'mdi-tools'
        // }
    ],
    home: '6028f7a6728fb7336cfedf2d',
    history_size: 100,
    cors: true,
    email: {
        host: 'smtp.163.com',
        port: '465',
        secure: true,
        auth: {
            user: 'rookiewiki@163.com',
            pass: 'RQNTRPMSMRLMUTZD',
        },
    },
    base: 'http://localhost:8080'
}