import NotFound from './error';
import PathMatcher from './path';

export function merge(path, parent) {
  return `${parent && parent !== '/' ? parent : ''}${path || ''}`;
}

export function walk(path, cb) {
  path.split('/').some(x => cb(`/${x}`));
}

export function sort(routes) {
  routes.sort((a, b) => {
    const x = a.includes('*') || a.includes(':');
    const y = b.includes('*') || b.includes(':');

    if (x && !y) {
      return a.length > b.length ? -1 : 1;
    }

    const m = a.split('/').length;
    const n = b.split('/').length;

    return (b.length - a.length) + (m - n);
  });
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
      let partial;

      if (root.keys) {
        partial = root.keys.some(k => {
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
      }

      if (!partial) {
        throw new NotFound(path, x);
      }
    } else {
      root = root[x];
    }

    const fixedPath = (splat ? path : leaf.join('')) || '/';

    if (root.info && !root.info.route) {
      root.info.route = fixedPath;
    }

    out.push({
      ...(root && root.info),
      path: fixedPath,
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
      sort(root.keys);
    }

    root = root[x] || (root[x] = {});
  });

  root.pattern = new PathMatcher(fullpath);
  root.route = fullpath;
  root.info = { ...routeInfo };

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
