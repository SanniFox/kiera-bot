import { RouteConfiguration } from '../utils/router';
import * as Commands from '../commands';

export const Routes: Array<RouteConfiguration> = [
  {
    commandTarget: 'none',
    controller: Commands.Devices.devicesConnectedCount,
    example: '!devices',
    name: 'devices-connected',
    validate: '/devices:string/connected:string'
  },

]