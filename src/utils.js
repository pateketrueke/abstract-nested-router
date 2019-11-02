import NotFound from './error';
import PathMatcher from './path';

export function merge(path, parent) {
  return `${parent && parent !== '/' ? parent : ''}${path || ''}`;
}

export function walk(path, cb) {
  const matches = path.match(/<[^<>]*\/[^<>]*>/);

  if (matches) {
    throw new TypeError(`RegExp cannot contain slashes, given '${matches}'`);
  }

  const parts = path.split(/(?=\/|#)/);
  const root = [];

  if (parts[0] !== '/') {
    parts.unshift('/');
  }

  parts.some((x, i) => {
    const parent = root.slice(1).concat(x).join('') || null;
    const segment = parts.slice(i + 1).join('') || null;
    const retval = cb(x, parent, segment ? `${x !== '/' ? x : ''}${segment}` : null);

    root.push(x);

    return retval;
  });
}

export function reduce(key, root, _seen) {
  const params = {};
  const out = [];

  let splat;

  walk(key, (x, leaf, extra) => {
    let found;

    if (!root.keys) {
      throw new NotFound(key, x);
    }

    root.keys.some(k => {
      if (_seen.includes(k)) return false;

      const { match, _isSplat } = root[k].pattern;
      const matches = match(_isSplat ? extra || x : x);

      if (matches) {
        Object.assign(params, matches);

        if (root[k].route) {
          const routeInfo = { ...root[k].info };

          // properly handle exact-routes!
          let hasMatch = false;

          if (routeInfo.exact) {
            hasMatch = extra === null;
          } else {
            hasMatch = (x && leaf === null) || x === leaf || _isSplat || !extra;
          }

          routeInfo.matches = hasMatch;
          routeInfo.params = { ...params };
          routeInfo.route = root[k].route;
          routeInfo.path = _isSplat ? extra : leaf || x;

          out.push(routeInfo);
        }

        if (extra === null && !root[k].keys) {
          return true;
        }

        if (k !== '/') _seen.push(k);
        splat = _isSplat;
        root = root[k];
        found = true;
        return true;
      }

      return false;
    });

    if (!(found || root.keys.some(k => root[k].pattern.match(x)))) {
      throw new NotFound(key, x);
    }

    return splat || !found;
  });

  return out;
}

export function find(path, routes, retries) {
  const get = reduce.bind(null, path, routes);
  const set = [];

  while (retries > 0) {
    retries -= 1;

    try {
      return get(set);
    } catch (e) {
      if (retries > 0) {
        return get(set);
      }

      throw e;
    }
  }
}

export function add(path, routes, parent, routeInfo) {
  const fullpath = merge(path, parent);

  let root = routes;
  let key;

  if (routeInfo && routeInfo.nested !== true) {
    key = routeInfo.key;
    delete routeInfo.key;
  }

  walk(fullpath, (x, leaf) => {
    root = PathMatcher.push(x, root, leaf, fullpath);

    if (x !== '/') {
      root.info = root.info || { ...routeInfo };
    }
  });

  root.info = root.info || { ...routeInfo };

  if (key) {
    root.info.key = key;
  }

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

    if (!leaf.keys) {
      throw new NotFound(path, x);
    }

    root = root[x];
  });

  if (!(leaf && key)) {
    throw new NotFound(path, key);
  }

  delete leaf[key];

  if (key === '/') {
    delete leaf.info;
    delete leaf.route;
  }

  const offset = leaf.keys.indexOf(key);

  if (offset !== -1) {
    leaf.keys.splice(leaf.keys.indexOf(key), 1);
    PathMatcher.sort(leaf);
  }
}
