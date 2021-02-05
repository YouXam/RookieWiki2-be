module.exports = {
    get_permission: async function(ctx, db) {
        return ((ctx.state.user && await db.collection('users').findOne({ username: ctx.state.user.username })) || { permission: 1 }).permission
    }
}