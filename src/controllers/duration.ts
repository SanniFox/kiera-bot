import * as Utils from '../utils';
import { RouterRouted } from '../utils/router';
import { DeviceSession } from '../objects/sessions';

export namespace Duration {
  export async function setDurationTime(routed: RouterRouted) {
    const userArgType = Utils.User.verifyUserRefType(routed.v.o.user)
    const userAt = Utils.User.buildUserChatAt(routed.v.o.user, userArgType)
    const userQuery = Utils.User.buildUserQuery(routed.v.o.user, userArgType)
    const newTime = routed.v.o.value
    const key = routed.v.o.key
    // User min or max
    const isMinOrMax = routed.v.o.key === 'min' || routed.v.o.key === 'max'
    // Ensure its one of these 2 or throw error
    if (!isMinOrMax) return await routed.message.reply(
      `must be \`!duration @user#0000 min ${newTime}\` or \`!duration @user#0000 max ${newTime}\``)

    // Get user's _id from the db
    const targetUser = await routed.bot.Users.get(userQuery)

    // Ensure target user is setup & has a session
    if (!targetUser) return await routed.message.reply(
      `User: \`@user#0000\` could not be found, make sure they've used the following: \`!register\``)

    const userSession = await routed.bot.Sessions.get({
      uid: targetUser._id,
      isActive: false,
      isDeactivated: false,
      isCompleted: false,
    })

    // Ensure session exists
    if (!userSession) return await routed.message.reply(
      `User: \`@user#0000\` needs to create a session \`!session new lovense\``)

    // Update props
    const nsession = new DeviceSession(userSession)
    nsession.duration[key] = newTime

    // Update in db
    await routed.bot.Sessions.update({ _id: userSession._id }, nsession)

    // Process command
    await routed.message.reply(
      `:white_check_mark: Setting duration ${userAt} ${key} to: \`${newTime}\` minutes`)
    routed.bot.DEBUG_MSG_COMMAND(`!duration ${userAt} ${key} ${newTime}`)
  }
}