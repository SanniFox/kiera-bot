/**
 * Splits args at spaces
 * 
 * Additional: will remove excess whitespaces to prevent messing up the \s split
 * 
 * @export
 * @param {string} msg
 * @returns
 */
export function getArgs(msg: string) {
  return msg.replace(/^\!/, '').replace(/\s+/g, ' ').split(' ')
}

export * from './utils/chastikey';
export * from './utils/channel';
export * from './utils/react';
export * from './utils/router';
export * from './utils/validate';
export * from './utils/user';