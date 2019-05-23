import { find, add, rm } from './utils';

export default class Router {
  constructor() {
    const routes = {};
    const stack = [];

    return {
      mount: (path, cb) => {
        if (path !== '/') {
          stack.push(path);
        }

        cb();
        stack.pop();
      },
      find: path => find(path, routes),
      add: (path, routeInfo) => add(path, routes, stack.join('') || '/', routeInfo),
      rm: path => rm(path, routes, stack.join('') || '/'),
    };
  }
}
