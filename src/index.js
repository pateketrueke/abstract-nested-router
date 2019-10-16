import { find, add, rm } from './utils';

export default class Router {
  constructor() {
    const routes = {};
    const stack = [];

    return {
      resolve: (path, cb) => {
        const [uri, hash, query] = path.split(/(?=[#?])/);

        const segments = uri.substr(1).split('/');
        const prefix = [];
        const seen = [];
        const map = [];

        segments.some(key => {
          const sub = prefix.concat(`/${key}`).join('');

          if (key.length) prefix.push(`/${key}`);

          try {
            const next = find(sub, routes, 1);

            cb(null, next.filter(x => {
              if (!seen.includes(x.route)) {
                seen.push(x.route);
                map.push(x);
                return true;
              }

              return false;
            }));
          } catch (e) {
            cb(e, []);
            return true;
          }

          return false;
        });

        if (hash) {
          cb(null, find(`${uri}${hash}`, routes, 1));
        }
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
}
