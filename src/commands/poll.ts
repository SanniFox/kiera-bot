import * as Utils from '@/utils'
import { RouterRouted, ExportRoutes } from '@/router'
import { TrackedPoll } from '@/objects/poll'
import { ObjectID } from 'bson'
import { Message } from 'discord.js'
import { poll } from '@/embedded/poll'

export const Routes = ExportRoutes(
  {
    type: 'message',
    category: 'Fun',
    commandTarget: 'argument',
    controller: voteNew,
    example: '{{prefix}}poll new "Is Kiera the cat cute?"',
    name: 'poll-new',
    validate: '/poll:string/new:string/question=string'
  },
  {
    type: 'message',
    category: 'Fun',
    commandTarget: 'argument',
    controller: voteEdit,
    example: '{{prefix}}poll edit 5cfcf44614e8a64034ca89f3 public false',
    name: 'poll-edit',
    validate: '/poll:string/edit:string/id=string/property=string/update=string'
  },
  {
    type: 'message',
    category: 'Fun',
    commandTarget: 'argument',
    controller: startPoll,
    example: '{{prefix}}poll start 5cfcf44614e8a64034ca89f3',
    name: 'poll-start',
    validate: '/poll:string/start:string/id=string'
  },
  {
    type: 'message',
    category: 'Fun',
    commandTarget: 'argument',
    controller: stopPoll,
    example: '{{prefix}}poll stop 5cfcf44614e8a64034ca89f3',
    name: 'poll-stop',
    validate: '/poll:string/stop:string/id=string'
  },
  {
    type: 'message',
    category: 'Fun',
    commandTarget: 'argument',
    controller: pickRandomVote,
    example: '{{prefix}}poll pick random 5cfcf44614e8a64034ca89f3 :thumbsup:',
    name: 'poll-pick-random-vote',
    validate: '/poll:string/pick:string/random:string/id=string/emoji=string'
  },
  {
    type: 'message',
    category: 'Fun',
    commandTarget: 'argument',
    controller: addOption,
    example: '{{prefix}}poll add option 5cfcf44614e8a64034ca89f3 :thumbsup: "Optional description here"',
    name: 'poll-add-option',
    validate: '/poll:string/add:string/option:string/id=string/emoji=string/description?=string'
  },
  {
    type: 'message',
    category: 'Fun',
    commandTarget: 'argument',
    controller: removeOption,
    example: '{{prefix}}poll add option 5cfcf44614e8a64034ca89f3 :thumbsup:',
    name: 'poll-remove-option',
    validate: '/poll:string/remove:string/option:string/id=string/optionID=string'
  },
  {
    type: 'reaction',
    category: 'Fun',
    commandTarget: 'controller-decision',
    controller: handleReact,
    name: 'poll-react-vote'
  }
)

/**
 * Create a new poll
 * @export
 * @param {RouterRouted} routed
 */
export async function voteNew(routed: RouterRouted) {
  // Commit record to db
  const insertedRecordID = await routed.bot.DB.add(
    'polls',
    new TrackedPoll({
      authorID: routed.user.id,
      question: routed.v.o.question
    })
  )

  await routed.message.reply(
    Utils.sb(Utils.en.poll.newPollCreated, {
      id: insertedRecordID,
      question: routed.v.o.question
    })
  )

  return true
}

/**
 * Edit an existing poll
 * @export
 * @param {RouterRouted} routed
 */
export async function voteEdit(routed: RouterRouted) {
  // Find poll in db
  var storedPoll = await routed.bot.DB.get<TrackedPoll>('polls', {
    _id: new ObjectID(routed.v.o.id),
    authorID: routed.user.id
  })

  if (storedPoll) {
    // Construct poll for prop & helpers from class
    storedPoll = new TrackedPoll(storedPoll)
    var _previousValue: any

    switch (routed.v.o.property) {
      case 'open':
        _previousValue = storedPoll.isOpen
        storedPoll.isOpen = routed.v.o.update === 'true' ? true : false
        break
      case 'public':
        _previousValue = storedPoll.isPublic
        storedPoll.isPublic = routed.v.o.update === 'true' ? true : false
        break
      case 'question':
        _previousValue = storedPoll.question
        storedPoll.question = routed.v.o.update
        break
      case 'title':
        _previousValue = storedPoll.title
        storedPoll.title = routed.v.o.update
        break
      case 'footer':
        _previousValue = storedPoll.footer
        storedPoll.footer = routed.v.o.update
        break

      // Default catch and return message - Stop here
      default:
        await routed.message.reply(Utils.sb(Utils.en.poll.pollPropertyNotFound))
        return false // Stop here
    }

    // Perform DB Update
    const updateCount = await routed.bot.DB.update<TrackedPoll>('polls', { _id: new ObjectID(routed.v.o.id) }, storedPoll)

    // Update successful
    if (updateCount > 0)
      await routed.message.reply(
        Utils.sb(Utils.en.poll.pollPropertyUpdated, {
          id: routed.v.o.id,
          property: routed.v.o.property,
          from: _previousValue,
          to: routed.v.o.update
        })
      )

    return true
  } else {
    // Can't find poll in DB
    await routed.message.reply(Utils.sb(Utils.en.poll.pollNotFoundInDB))
    return false
  }
}

/**
 * Reaction event handler
 *
 * @export
 * @param {RouterRouted} routed
 * @returns
 */
export async function handleReact(routed: RouterRouted) {
  // Reaction added
  // Find poll in db
  var storedPoll = await routed.bot.DB.get<TrackedPoll>('polls', {
    messageID: new ObjectID(routed.trackedMessage._id)
  })

  if (storedPoll) {
    storedPoll = new TrackedPoll(storedPoll)
    // Stop if poll is expired/closed
    if (!storedPoll.isOpen) {
      await routed.user.send(Utils.sb(Utils.en.poll.pollExpired))
      return true // Stop here
    }

    // Add / Remove react
    if (routed.state === 'added') {
      storedPoll.addVote(routed.user.id, routed.message.guild.id, routed.reaction.reaction)

      // Update in DB
      const updateCount = await routed.bot.DB.update<TrackedPoll>('polls', { messageID: new ObjectID(routed.trackedMessage._id) }, storedPoll)

      if (updateCount > 0) await routed.user.send(Utils.sb(Utils.en.poll.pollVoteCast))
      return true // Stop here
    } else {
      var deleteCount = await routed.bot.DB.update<TrackedPoll>(
        'polls',
        <any>{
          messageID: new ObjectID(routed.trackedMessage._id),
          'votes.authorID': routed.user.id,
          'votes.vote': routed.reaction.reaction
        },
        { $pull: { votes: { authorID: routed.user.id, vote: routed.reaction.reaction } } },
        { atomic: true }
      )

      if (deleteCount > 0) await routed.user.send(Utils.sb(Utils.en.poll.pollVoteRemoved))
      return true // Stop here
    }
  }

  return false
}

/**
 * Prints the block which users may vote upon
 *
 * @export
 * @param {RouterRouted} routed
 * @returns
 */
export async function startPoll(routed: RouterRouted) {
  // Find poll in db
  var storedPoll = await routed.bot.DB.get<TrackedPoll>('polls', {
    // Lookup by given ObjectID in args
    _id: new ObjectID(routed.v.o.id)
  })

  if (storedPoll) {
    // Construct Object
    storedPoll = new TrackedPoll(storedPoll)

    // Only allow the author to startPoll on their own
    if (storedPoll.authorID !== routed.message.author.id) {
      await routed.message.reply(Utils.sb(Utils.en.poll.pollDifferentAuthorID))
      return false // Stop Here
    }
    1

    // Print message to chat for members to vote upon
    const messageSent = (await routed.message.channel.send(poll(storedPoll))) as Message

    // Track Message
    const messageID = await routed.bot.MsgTracker.trackNewMsg(messageSent, { reactionRoute: 'poll-react-vote' })

    // Update Message ID & snowflake to watch for
    storedPoll.messageID = messageID
    storedPoll.messageSnowflake = messageSent.id

    // Update in db
    await routed.bot.DB.update<TrackedPoll>('polls', { _id: new ObjectID(routed.v.o.id) }, storedPoll)
    // await routed.message.reply('```json\n' + JSON.stringify(storedPoll, null, 2) + '```')
  } else {
    await routed.message.reply(Utils.sb(Utils.en.poll.pollNotFoundInDB))
  }

  return true
}

/**
 * Ends a currently running poll from tracking new emojis (votes)
 *
 * @export
 * @param {RouterRouted} routed
 * @returns
 */
export async function stopPoll(routed: RouterRouted) {
  // Find poll in db
  var storedPoll = await routed.bot.DB.get<TrackedPoll>('polls', {
    // Lookup by given ObjectID in args
    _id: new ObjectID(routed.v.o.id)
  })

  if (storedPoll) {
    // Construct Object
    storedPoll = new TrackedPoll(storedPoll)

    // Only allow the author to stopPoll on their own
    if (storedPoll.authorID !== routed.message.author.id) {
      await routed.message.reply(Utils.sb(Utils.en.poll.pollDifferentAuthorID))
      return false // Stop Here
    }

    // Print message to chat informing users the poll has concluded
    await routed.message.reply(Utils.sb(Utils.en.poll.pollEnded))

    // Update open status
    storedPoll.isOpen = false

    // Update in db
    await routed.bot.DB.update<TrackedPoll>('polls', { _id: new ObjectID(routed.v.o.id) }, storedPoll)
  } else {
    await routed.message.reply(Utils.sb(Utils.en.poll.pollNotFoundInDB))
  }

  return true
}

/**
 * Randomly selects and prints a vote by a user of the given emoji type
 *
 * @export
 * @param {RouterRouted} routed
 * @returns
 */
export async function pickRandomVote(routed: RouterRouted) {
  // Find poll in db
  var storedPoll = await routed.bot.DB.get<TrackedPoll>('polls', {
    // Lookup by given ObjectID in args
    _id: new ObjectID(routed.v.o.id)
  })

  if (storedPoll) {
    // Construct Object
    storedPoll = new TrackedPoll(storedPoll)

    // Only allow the author to call on their own
    if (storedPoll.authorID !== routed.message.author.id) {
      await routed.message.reply(Utils.sb(Utils.en.poll.pollDifferentAuthorID))
      return false // Stop Here
    }

    const randomReaction = storedPoll.pickRandomVote(routed.v.o.emoji)

    await routed.message.channel.send(
      Utils.sb(Utils.en.poll.pollRandomVoteSelected, {
        by: Utils.User.buildUserWrappedSnowflake(randomReaction.authorID),
        emoji: randomReaction.vote
      })
    )
  } else {
    await routed.message.reply(Utils.sb(Utils.en.poll.pollNotFoundInDB))
  }

  return true
}

/**
 * Adds an option to the current poll for calculating outcomes on
 *
 * @export
 * @param {RouterRouted} routed
 * @returns
 */
export async function addOption(routed: RouterRouted) {
  // Find poll in db
  var storedPoll = await routed.bot.DB.get<TrackedPoll>('polls', {
    // Lookup by given ObjectID in args
    _id: new ObjectID(routed.v.o.id)
  })

  if (storedPoll) {
    // Construct Object
    storedPoll = new TrackedPoll(storedPoll)

    // Only allow the author to call on their own
    if (storedPoll.authorID !== routed.message.author.id) {
      await routed.message.reply(Utils.sb(Utils.en.poll.pollDifferentAuthorID))
      return false // Stop Here
    }

    const optionID = storedPoll.addVoteOption(routed.v.o.emoji, routed.v.o.description)

    // Update in db
    await routed.bot.DB.update<TrackedPoll>('polls', { _id: new ObjectID(routed.v.o.id) }, storedPoll)

    await routed.message.reply(
      Utils.sb(Utils.en.poll.pollOptionAdded, {
        id: routed.v.o.id,
        optionID: optionID,
        emoji: routed.v.o.emoji,
        description: routed.v.o.description || ''
      })
    )
  }

  return true
}

/**
 * Removes an option to the current poll for calculating outcomes on
 *
 * @export
 * @param {RouterRouted} routed
 * @returns
 */
export async function removeOption(routed: RouterRouted) {
  // Find poll in db
  var storedPoll = await routed.bot.DB.get<TrackedPoll>('polls', {
    // Lookup by given ObjectID in args
    _id: new ObjectID(routed.v.o.id)
  })

  if (storedPoll) {
    // Construct Object
    storedPoll = new TrackedPoll(storedPoll)

    // Only allow the author to call on their own
    if (storedPoll.authorID !== routed.message.author.id) {
      await routed.message.reply(Utils.sb(Utils.en.poll.pollDifferentAuthorID))
      return false // Stop Here
    }

    var deleteCount = await routed.bot.DB.update<TrackedPoll>(
      'polls',
      <any>{ _id: new ObjectID(routed.v.o.id), 'emojiOptions._id': new ObjectID(routed.v.o.optionID) },
      { $pull: { emojiOptions: { _id: new ObjectID(routed.v.o.optionID) } } },
      { atomic: true }
    )

    // If there was no vote option to remove: inform the user
    if (!deleteCount) {
      await routed.message.reply(
        Utils.sb(Utils.en.poll.pollOptionNotFound, {
          optionID: routed.v.o.optionID
        })
      )
      return false // Stop here
    }

    await routed.message.reply(
      Utils.sb(Utils.en.poll.pollOptionRemoved, {
        optionID: routed.v.o.optionID
      })
    )
  }

  return true
}
