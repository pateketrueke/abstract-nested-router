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
  const parent = root.refs;
  const params = {};
  const out = [];

  let splat;
  walk(key, (x, leaf, extra) => {
    if (!root.keys) {
      throw new NotFound(key, x);
    }

    let found;
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
            hasMatch = !(x && leaf === null) || x === leaf || _isSplat || !extra;
          }

          routeInfo.matches = hasMatch;
          routeInfo.params = { ...params };
          routeInfo.route = root[k].route;
          routeInfo.path = (_isSplat && extra) || leaf || x;

          if (parent[routeInfo.route]) {
            routeInfo.key = parent[routeInfo.route];

            if (routeInfo.path.substr(-1) === '/') {
              routeInfo.key = parent[`${routeInfo.route}/`] || routeInfo.key;
            }
          }

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
  const params = { ...routeInfo };

  let root = routes;
  walk(fullpath, (x, leaf) => {
    root = PathMatcher.push(x, root, leaf, fullpath);

    if (x !== '/') {
      root.info = { ...params, ...root.info };
    }
  });

  if (params.key && !routes.refs[params.key]) {
    routes.refs[params.key] = fullpath;
    routes.refs[fullpath] = params.key;
  }

  root.info = { ...root.info, ...routeInfo };

  if (fullpath !== '/' && fullpath.substr(-1) === '/') {
    const prop = fullpath.replace(/(?<=.)\/$/, '');

    routes.refs[prop] = routes.refs[prop] || params.key;
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

    if (!root.keys) {
      throw new NotFound(path, x);
    }

    key = x;
    leaf = root;
    root = root[key];
  });

  if (!(leaf && key)) {
    throw new NotFound(path, key);
  }

  if (leaf === routes) {
    leaf = routes['/'];
  }

  if (leaf.route !== key) {
    const offset = leaf.keys.indexOf(key);

    if (offset === -1) {
      throw new NotFound(path, key);
    }

    leaf.keys.splice(offset, 1);
    PathMatcher.sort(leaf);

    delete leaf[key];
  }

  // nested routes are upgradeable, so keep original info...
  if (root.route === leaf.route
    && (!root.info || (root.info.key === leaf.info.key))) delete leaf.info;
}
