import * as Validation from '../validations/index';
import * as errors from 'restify-errors';
import { validate } from '../utils/validate';
import { WebRouted } from '../web-router';
import { CommandPermissions } from '../../objects/permission';
import { ObjectID } from 'bson';
import { routeLoader } from '../../router/route-loader';
import { sb } from '../../utils';

export namespace Permissions {
  export async function getAll(routed: WebRouted) {
    const v = await validate(Validation.Permissions.getAll(), routed.req.body)
    // await validate(Validation.Permissions.getAll(), req.body)
    // tslint:disable-next-line:no-console
    console.log(v)
    // this.DEBUG_WEBAPI('req params', v.o)

    if (v.valid) {
      // Get the same routes the router loader uses
      const routes = routeLoader()
      // Get permissions stored in the db
      const permissions = await routed.Bot.DB.getMultiple<CommandPermissions>('command-permissions', { serverID: v.o.serverID })
      // Sort by permission name
      permissions.sort((a, b) => {
        var x = a.command.toLowerCase();
        var y = b.command.toLowerCase();
        if (x < y) { return -1; }
        if (x > y) { return 1; }
        return 0;
      })

      // Map in the route examples & categories
      permissions.map(p => {
        const matchingRoute = routes.find(r => r.name === p.command)
        p.example = sb(matchingRoute.example)
        p.category = matchingRoute.category
      })

      return routed.res.send(permissions);
    }

    // On error
    return routed.next(new errors.BadRequestError());
  }

  export async function get(routed: WebRouted) {
    const v = await validate(Validation.Permissions.get(), routed.req.body)

    // this.DEBUG_WEBAPI('req params', v.o)

    // if (v.valid) {
    //   var permission = await routed.Bot.Permissions.get({
    //     _id: new ObjectID(v.o.id),
    //   })

    //   // If session does not exist, return error
    //   if (!permission) return routed.next(new errors.BadRequestError());
    //   return routed.res.send(permission);
    // }

    // On error
    return routed.next(new errors.BadRequestError());
  }

  export async function updateGlobal(routed: WebRouted) {
    const v = await validate(Validation.Permissions.updateGlobal(), routed.req.body)

    if (v.valid) {
      // Update global permission in db
      const updateCount = await routed.Bot.DB.update(
        'command-permissions',
        { _id: new ObjectID(v.o._id) },
        { enabled: v.o.state })
      if (updateCount > 0) return routed.res.send({ status: 'updated', success: true });
      return routed.res.send({ status: 'failed', success: false });
    }

    // On error
    return routed.next(new errors.BadRequestError());
  }

  export async function deleteGlobal(routed: WebRouted) {
    const v = await validate(Validation.Permissions.deleteGlobal(), routed.req.body)

    if (v.valid) {
      // Update allowed permission in db
      const deleteCount = await routed.Bot.DB.remove(
        'command-permissions', {
          _id: new ObjectID(v.o._id),
        })
      if (deleteCount > 0) return routed.res.send({ status: 'deleted', success: true });
      return routed.res.send({ status: 'failed', success: false });
    }

    // On error
    return routed.next(new errors.BadRequestError());
  }

  export async function updateAllowed(routed: WebRouted) {
    const v = await validate(Validation.Permissions.updateAllowed(), routed.req.body)

    if (v.valid) {
      // Update allowed permission in db
      const updateCount = await routed.Bot.DB.update(
        'command-permissions', {
          _id: new ObjectID(v.o._id),
          command: v.o.command,
          'allowed.target': v.o.target
        }, {
          $set: {
            'allowed.$.allow': v.o.state
          }
        }, { atomic: true })
      if (updateCount > 0) return routed.res.send({ status: 'updated', success: true });
      return routed.res.send({ status: 'failed', success: false });
    }

    // On error
    return routed.next(new errors.BadRequestError());
  }
}