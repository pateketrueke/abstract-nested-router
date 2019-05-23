import Path from 'path-parser';

export class NotFound extends Error {
  constructor(route, path) {
    super(`Unreachable '${route}', segment '${path}' is not defined`);
  }
}

export function merge(path, parent) {
  return `${parent !== '/' ? parent : ''}${path}`;
}

export function clean(path) {
  return path.replace(/#(!\/)?/, '/');
}

export function walk(path, cb) {
  path.split('/').some(x => cb(`/${x}`));
}

export function find(path, routes) {
  const leaf = [];

  let out = [];
  let root = routes;
  let splat = false;

  walk(path, x => {
    if (!root) {
      out = [];
      return true;
    }

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

export function add(path, routes, parent = '/', routeInfo = null) {
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

export function rm(path, routes, parent = '/') {
  const fullpath = merge(path, parent);

  let root = routes;
  let del = [];

  walk(fullpath, x => {
    if (!root) {
      del = [];
      return false;
    }

    if (x !== '/') {
      del.push({
        remove: x,
        parent: root,
      });
    }

    root = root[x];
  });

  del.forEach(k => {
    delete k.parent[k.remove];
  });
}
