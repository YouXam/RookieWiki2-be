const Counter = require('passthrough-counter')
const bytes = require('bytes')
const chalk = require('chalk')
const util = require('util')
const colorCodes = {
    7: 'magenta',
    5: 'red',
    4: 'yellow',
    3: 'cyan',
    2: 'green',
    1: 'green',
    0: 'yellow'
}
module.exports = function (opts) {
    const print = (function () {
        let transporter = typeof opts === 'function' ? opts : opts && opts.transporter ? opts.transporter : undefined
        return function printFunc(...args) {
            if (transporter) transporter(util.format(...args), args)
            else console.log(...args)
        }
    }())
    return async function logger(ctx, next) {
        const start = ctx[Symbol.for('request-received.startTime')] ? ctx[Symbol.for('request-received.startTime')].getTime() : Date.now()
        print(` ${chalk.gray('<--')} ${chalk.blue('%s')} ${chalk.bold('%s')} ${chalk.gray('%s')}`, ctx.ip, ctx.method, ctx.originalUrl)
        try {
            await next()
        } catch (err) {
            log(print, ctx, start, null, err)
            throw err
        }
        const length = ctx.response.length,  body = ctx.body
        let counter
        if (length == null && body && body.readable) ctx.body = body.pipe(counter = Counter()).on('error', ctx.onerror)
        const res = ctx.res, onfinish = done.bind(null, 'finish'), onclose = done.bind(null, 'close')
        res.once('finish', onfinish)
        res.once('close', onclose)
        function done(event) {
            res.removeListener('finish', onfinish)
            res.removeListener('close', onclose)
            log(print, ctx, start, counter ? counter.length : length, null, event)
        }
    }
}
function log(print, ctx, start, len, err, event) {
    const status = err ? (err.isBoom ? err.output.statusCode : err.status || 500) : (ctx.status || 404)
    const s = status / 100 | 0
    // eslint-disable-next-line
    const color = colorCodes.hasOwnProperty(s) ? colorCodes[s] : colorCodes[0]
    const length = ~[204, 205, 304].indexOf(status) ? '' : len ? bytes(len) : '-'
    const upstream = err ? chalk.red('xxx') : event === 'close' ? chalk.yellow('-x-') : chalk.gray('-->')
    print(` ${upstream} ${chalk.bold('%s')} ${chalk.gray('%s')} ${chalk[color]('%s')} ${chalk.gray('%s')} ${chalk.gray('%s')}`,
        ctx.method, ctx.originalUrl, status, time(start), length)
}
function time(start) {
    const delta = Date.now() - start
    return (delta < 10000 ? delta + 'ms' : Math.round(delta / 1000) + 's').toString()
}