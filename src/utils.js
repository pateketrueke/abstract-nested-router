import Path from 'path-parser';

export class NotFound extends Error {
  constructor(route, path) {
    super(`Unreachable '${route}', segment '${path}' is not defined`);
  }
}

export function merge(path, parent) {
  return `${parent && parent !== '/' ? parent : ''}${path}`;
}

export function clean(path) {
  return path.replace(/#(!\/)?/, '/');
}

export function walk(path, cb) {
  path.split('/').some(x => cb(`/${x}`));
}

export function find(path, routes) {
  const leaf = [];
  const out = [];

  let root = routes;
  let splat = false;

  walk(path, x => {
    if (splat) {
      return true;
    }

    if (x !== '/') {
      leaf.push(x);
    }

    if (!root[x]) {
      const partial = Object.keys(root).some(k => {
        if (k.charAt() === '/' && root[k].match) {
          const matches = root[k].match.partialTest(clean(path));

          if (matches) {
            splat = root[k].match.hasSpatParam;
            root[k].info.route = root[k].route;
            root[k].info.params = matches;
            root = root[k];
            return true;
          }
        }

        return false;
      });

      if (!partial) {
        throw new NotFound(path, x);
      }
    } else {
      root = root[x];
    }

    out.push({
      ...(root && root.info),
      path: (splat ? path : leaf.join('')) || '/',
    });
  });

  return out;
}

export function add(path, routes, parent, routeInfo) {
  const fullpath = merge(path, parent);

  let root = routes;

  walk(fullpath, x => {
    root = root[x] || (root[x] = {});
  });

  if (fullpath.includes(':') || fullpath.includes('*')) {
    root.match = new Path(clean(fullpath));
  }

  root.route = fullpath;
  root.info = routeInfo;
}

export function rm(path, routes, parent) {
  const fullpath = merge(path, parent);

  let root = routes;
  let leaf = null;
  let key = null;

  walk(fullpath, x => {
    if (!root) {
      leaf = null;
      return true;
    }

    key = x;
    leaf = x === '/' ? routes['/'] : root;

    root = root[x];
  });

  if (!leaf) {
    throw new NotFound(path, key);
  }

  delete leaf[key];
}
