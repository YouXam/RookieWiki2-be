const mongodb = require('mongodb')
const ObjectId = mongodb.ObjectId
module.exports = {
    getParams: function (ctx, error, key='id') {
        try {
            return ObjectId(ctx.params[key])
        }  catch {
            ctx.json({ code: 404, msg: error })
            return false
        }
    }
}