import * as NEDB from 'nedb';
import { TrackedUser } from '../user';

var UsersDB = new NEDB({
  filename: './db/USERS.db',
  autoload: true
});

export class UserDB {
  public add(user: TrackedUser) {
    return new Promise<TrackedUser>((ret) => {
      UsersDB.insert<TrackedUser>(user, (err, user) => {
        if (err) throw err
        return ret(user)
      })
    })
  }

  public verify(id: string) {
    return new Promise<boolean>((ret) => {
      UsersDB.find<TrackedUser[]>({ id: id }, (err, user) => {
        if (err) throw err
        return ret(user.length > 0)
      })
    })
  }

  public remove() { }

  public update(user: TrackedUser) {
    return new Promise<TrackedUser>((ret) => {
      UsersDB.update<TrackedUser>({ id: user.id }, user, { upsert: true }, (err, _user) => {
        if (err) throw err
        return ret(user)
      })
    })
  }
}