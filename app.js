const http = require('http')
const Koa = require('koa')
const mongodb = require('mongodb')

const koa = new Koa()

const config = require('./config')

async function main() {
    const client = await mongodb.MongoClient.connect('mongodb://localhost/', { useUnifiedTopology: true })
    const db = client.db('rookiewiki')

    // 添加一些中间件
    const add_before_middleware = require('./lib/before')
    add_before_middleware(koa, config, db)

    // 不需要登录验证的 api
    const add_public_router = require('./router/public')
    add_public_router(koa, config, db)

    // 需要的登录验证的 api
    const add_private_router = require('./router/private')
    add_private_router(koa, config, db)
    http.createServer(koa.callback()).listen(config.port, '0.0.0.0', (err) => {
        if (err) console.log(err)
        else console.log('App is listening on port ' + config.port + '.')
    })
}
main()