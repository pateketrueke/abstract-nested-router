import NotFound from './error';
import PathMatcher from './path';

export function merge(path, parent) {
  return `${parent && parent !== '/' ? parent : ''}${path}`;
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
      const partial = (root.keys || []).some(k => {
        if (root[k].pattern) {
          const matches = root[k].pattern.match(path);

          if (matches) {
            splat = root[k].pattern._isSplat;

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
    root.keys = root.keys || [];

    if (!root.keys.includes(x)) {
      root.keys.push(x);
    }

    root = root[x] || (root[x] = {});
  });

  root.pattern = new PathMatcher(fullpath);
  root.route = fullpath;
  root.info = routeInfo;

  return fullpath;
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

  const offset = leaf.keys.indexOf(key);

  leaf.keys.splice(offset, 1);

  delete leaf[key];
}
