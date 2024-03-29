import { walk, find, add, rm } from './utils';
import { buildMatcher } from './path';

export default class Router {
  constructor() {
    const routes = { refs: {} };
    const stack = [];

    return {
      routes,
      resolve: (path, cb) => {
        const url = path.split('?')[0];
        const seen = [];

        walk(url, (x, leaf, extra) => {
          try {
            cb(null, find(leaf, routes, 2).filter(r => {
              if (!seen.includes(r.route)) {
                seen.push(r.route);
                return true;
              }
              return false;
            }), leaf);
          } catch (e) {
            cb(e, []);
          }
        });
      },
      mount: (path, cb) => {
        if (path !== '/') {
          stack.push(path);
        }

        cb();
        stack.pop();
      },
      find: (path, retries) => find(path, routes, retries === true ? 2 : retries || 1),
      add: (path, routeInfo) => add(path, routes, stack.join(''), routeInfo),
      rm: path => rm(path, routes, stack.join('')),
    };
  }

  static matches(uri, path) {
    return buildMatcher(uri, path).regex.test(path);
  }
}
