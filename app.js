const Koa = require('koa')
const bodyParse = require('koa-body')
const mongodb = require('mongodb')

const koa = new Koa()

const config = require('./config')

async function main() {
    const client = await mongodb.MongoClient.connect('mongodb://localhost/', { useUnifiedTopology: true })
    const db = client.db('rookiewiki')
    koa.use(bodyParse({ multipart: true }))
    koa.use(async (ctx, next) => {
        ctx.json = json => {
            ctx.body = JSON.stringify(json)
            ctx.type = 'application/json'
        }
        await next()
    })

    // 不需要登录验证的 api
    const add_public_router = require('./router/public')
    add_public_router(koa, config, db)

    // 需要的登录验证的 api
    const add_private_router = require('./router/private')
    add_private_router(koa, config, db)
    
    koa.listen(config.port, () => console.log('App is listening on port ' + config.port + '.'))
}
main()