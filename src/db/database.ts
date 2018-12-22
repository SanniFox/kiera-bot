import * as NEDB from 'nedb';
import * as Debug from "debug";
import { Message } from 'discord.js';
import { EventEmitter } from 'events';
import { TrackedMessage } from '../message';

var DB_MSG_TRACKING = new NEDB({
  filename: '../db/MSG_TRACKING.db',
  autoload: true
});

////// FOR TESTING - REMOVE LATER //////
export class MsgTracker extends EventEmitter {
  private msgTrackingArr: Array<TrackedMessage> = []
  private msgProcesserRunning = false
  private msgCleanupInProgress = false
  private msgDeletionCleanupInProgress = false
  private msgProcesserInterval = Number(process.env.BOT_MESSAGE_CLEANUP_INTERVAL) // Current: 10 Seconds
  private msgCleanupAge = Number(process.env.BOT_MESSAGE_CLEANUP_AGE) // Current: 30 Seconds
  public DEBUG_MSG_TRACKER = Debug('lovense-discord-bot:MsgTracker');

  constructor() {
    super()
    // Block duplicates - if that somehow were possible......
    if (!this.msgProcesserRunning) {
      this.DEBUG_MSG_TRACKER('starting MsgTracker...')
      // Memory cleanup, remove old messages tracked beyond TrackedMessage.storage_keep_for age
      setInterval(() => this.trackedMsgCleanup(), this.msgProcesserInterval)
      // Scan msgArray for messages with TrackedMessage.flag_auto_delete === true beyond
      // their defined period
      setInterval(() => this.trackedMsgDeletionCleanup(), this.msgProcesserInterval)
    }
  }

  trackedMsgCleanup() {
    // Block duplicate cleanups if a previous is still running
    if (this.msgCleanupInProgress) return
    // Continue with cleanup
    const now = Date.now()

    // Check for any messages past the memory threshold
    var toCleanupArray = this.msgTrackingArr.filter(msg => {
      // Calculate message age
      const age = Math.round(now - msg.message_createdAt)
      if (age > msg.storage_keep_in_chat_for) return true
    })

    // Process cleanup
    if (toCleanupArray.length > 0) {
      for (let index = 0; index < toCleanupArray.length; index++) {
        const msgToClean = toCleanupArray[index];
        this.removeMemTrackedMsg(msgToClean.message_id)
      }
      // end cleanup
      this.msgCleanupInProgress = false
    }
  }

  trackedMsgDeletionCleanup() {
    // Block duplicate cleanups if a previous is still running
    if (this.msgDeletionCleanupInProgress) return
    // Continue with cleanup
    const now = Date.now()
    // Check for any messages past 10 seconds old
    var toCleanupArray = this.msgTrackingArr.filter(msg => {
      // Skip if TrackedMessage.flag_auto_delete === false
      if (!msg.flag_auto_delete) return;

      // Calculate message age
      const age = Math.round(now - msg.message_createdAt)
      const deleteAfter = msg.storage_keep_in_chat_for > 0 
        ? msg.storage_keep_in_chat_for
        : this.msgCleanupAge
      // If age of message meets the criteria (First check the TrackedMessage retain else fallback to .env)
      if (age > deleteAfter) {
        this.DEBUG_MSG_TRACKER(`cleanup => id:${msg.message_id} createdAt:${msg.message_createdAt} age:${age}`)
        return true
      }
    })

    // Process cleanup
    if (toCleanupArray.length > 0) {
      for (let index = 0; index < toCleanupArray.length; index++) {
        const msgToClean = toCleanupArray[index];
        this.removeTrackedMsg(msgToClean.message_id, msgToClean.channel_id)
      }
      // end cleanup
      this.msgCleanupInProgress = false
    }
  }

  trackMsg(msg: TrackedMessage) {
    // Track message in array
    this.msgTrackingArr.push(msg)
  }

  removeTrackedMsg(messageId: string, channelId: string) {
    // Trigger delete of message for keeping chat clean
    this.emit('msg-tracker--remove-msg', messageId, channelId)
    this.removeMemTrackedMsg(messageId)
  }

  removeMemTrackedMsg(messageId: string) {
    // Find msg id's index
    const foundMsgIndex = this.msgTrackingArr.findIndex(msg => msg.message_id === messageId)
    // Remove msg from tracking
    this.msgTrackingArr.splice(foundMsgIndex, 1)
  }
}
////// END REMOVE LATER           //////


export function trackNewMsg(msg: TrackedMessage, debug: Debug.IDebugger) {
  DB_MSG_TRACKING.insert<TrackedMessage>(msg)
}