import * as errors from 'restify-errors'
import * as Middleware from '@/api/middleware'
import * as Validation from '@/api/validations'
import { WebRouted, WebRoute } from '@/api/web-router'
import { TrackedUser } from '@/objects/user'
import { validate } from '@/api/utils/validate'
import { UserData, RunningLocksLock } from 'chastikey.js/app/objects'

export const Routes: Array<WebRoute> = [
  // * Kiera+CK Keyholder * //
  {
    controller: khData,
    method: 'get',
    name: 'ck-3rd-kh-view',
    path: '/api/ck/keyholder',
    middleware: [Middleware.validateSession]
  },
  // * Kiera+CK Lockee * //
  {
    controller: lockeeData,
    method: 'post',
    name: 'ck-3rd-lockee-view',
    path: '/api/ck/lockee',
    middleware: [Middleware.validateSession]
  },
  // * Kiera+CK Search * //
  {
    controller: search,
    method: 'post',
    name: 'ck-search',
    path: '/api/ck/search'
  },
  // * Kiera+CK User * //
  {
    controller: user,
    method: 'post',
    name: 'ck-user',
    path: '/api/ck/user'
  }
]

/**
 * Get KH compiled data for external view
 * @export
 * @param {WebRouted} routed
 * @returns
 */
export async function khData(routed: WebRouted) {
  // Find the user in ck-users first to help determine query for Kiera's DB (Find based off Username if requested)
  // var ckUser = new UserData(await routed.Bot.DB.get<UserData>('ck-users', { username: /Emma/i }))
  var ckUser = new UserData(
    await routed.Bot.DB.get<UserData>('ck-users', { discordID: routed.session.userID })
  )

  // If the lookup is upon someone else with no data, return the standard response
  if (!ckUser.userID) {
    return routed.next(new errors.BadRequestError())
  }

  const usernameRegex = new RegExp(`^${ckUser.username}$`, 'i')

  // Get lockees under a KH
  const cachedRunningLocks = await routed.Bot.DB.aggregate<{ _id: string; locks: Array<any>; count: number; uniqueCount: number }>('ck-running-locks', [
    {
      $match: { lockedBy: usernameRegex }
    },
    {
      $group: {
        _id: '$sharedLockName',
        locksArrayByLockedTime: { $addToSet: '$secondsLocked' },
        running: {
          $push: '$$ROOT'
        },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        name: '$_id',
        running: 1,
        uniqueCount: { $cond: { if: { $isArray: '$locksArrayByLockedTime' }, then: { $size: '$locksArrayByLockedTime' }, else: 0 } },
        avgLockedTime: { $avg: '$locksArrayByLockedTime' },
        count: 1
      }
    },
    { $sort: { name: 1 } }
  ])

  // If there is no data in the kh dataset inform the user
  if (!ckUser.timestampFirstKeyheld) {
    return routed.next(new errors.BadRequestError())
  }

  return routed.res.send({
    keyholder: ckUser,
    locks: cachedRunningLocks
  })
}

/**
 * Get Lockee compiled data for external view
 * @export
 * @param {WebRouted} routed
 * @returns
 */
export async function lockeeData(routed: WebRouted) {
  // const v = await validate(Validation.ChastiKey.lockeeFetch(), routed.req.body)
  // const hasUsernameInReq = v.o.username ? true : false
  const hasUsernameInReq = false

  // Find the user in ck-users first to help determine query for Kiera's DB (Find based off Username if requested)
  // var ckUser = new UserData(await routed.Bot.DB.get<UserData>('ck-users', { username: /Emma/i }))
  var ckUser = new UserData(
    await routed.Bot.DB.get<UserData>('ck-users', { discordID: routed.session.userID })
  )

  // If the lookup is upon someone else with no data, return the standard response
  if (!ckUser.userID) {
    return routed.next(new errors.BadRequestError())
  }

  // Get user from lockee data (Stats, User and Locks)
  const lockeeData = await routed.Bot.Service.ChastiKey.fetchAPILockeeData({
    discordid: hasUsernameInReq ? undefined : routed.session.userID,
    // username: hasUsernameInReq ? v.o.username : undefined,
    showDeleted: true
  })

  // If user does not exist, fail
  if (lockeeData.response.status !== 200) {
    return routed.next(new errors.BadRequestError())
  }

  // If the user has display_in_stats === 2 then stop here
  if (lockeeData.data.displayInStats === 2) {
    return routed.next(new errors.BadRequestError())
  }

  return routed.res.send({
    lockee: lockeeData.data,
    runningLocks: lockeeData.getLocked,
    allLocks: lockeeData.locks
  })
}

/**
 * Find Locks, Keyholders and Shared KH Locks matching the query
 * @export
 * @param {WebRouted} routed
 * @returns
 */
export async function search(routed: WebRouted) {
  const v = await validate(Validation.ChastiKey.search(), routed.req.body)

  if (v.valid) {
    const users = await routed.Bot.DB.getMultiple('ck-users', { username: new RegExp(`${v.o.query}`, 'i') })
    return routed.res.send(
      users.map((u: any) => {
        return { type: 'User', name: u.username, isVerified: u.discordID ? true : false }
      }) || []
    )
  }

  // Fallback, fail
  return routed.next(new errors.BadRequestError())
}

/**
 * Find user profile requested
 * @export
 * @param {WebRouted} routed
 * @returns
 */
export async function user(routed: WebRouted) {
  const v = await validate(Validation.ChastiKey.user(), routed.req.body)

  if (v.valid) {
    // Get the user from the ChastiKey user cache to keep from spamming Kevin's servers
    const ckUser = await routed.Bot.DB.get<UserData>('ck-users', { username: new RegExp(`${v.o.username}`, 'i') })

    // User's discord avatar (again, only if verified)
    const discordUser = ckUser.discordID ? await routed.Bot.client.fetchUser(ckUser.discordID) : null

    // If user does not exist, fail
    if (!ckUser) {
      return routed.next({ success: false })
    }

    // If the user has locks in the cache, get those to save on expensive calls to ChastiKey's API
    const lockeeData =
      ckUser.cumulativeSecondsLocked > 0
        ? await routed.Bot.Service.ChastiKey.fetchAPILockeeData({ discordid: discordUser ? discordUser.id : undefined, username: ckUser.username, showDeleted: true })
        : null

    // If the user has locks per the cache then query for those
    const keyholderData = ckUser.noOfSharedLocks ? await routed.Bot.Service.ChastiKey.fetchAPIKeyholderData({ discordid: discordUser ? discordUser.id : undefined, username: ckUser.username }) : null
    const asKeyholderSharedLocks = keyholderData ? (keyholderData.response.status === 200 ? keyholderData.locks.filter(l => l.sharedLockID !== '<hidden>') : []) : []

    return routed.res.send({
      success: true,
      user: ckUser,
      sharedLocks: asKeyholderSharedLocks,
      runningLocks: lockeeData.response.status === 200 ? lockeeData.getLocked : [],
      discord: discordUser ? { id: discordUser.id, avatar: discordUser.avatar } : { id: null, avatar: null }
    })
  }

  // Fallback, fail
  return routed.next(new errors.BadRequestError())
}
