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

export function reduce(key, root) {
  const parent = root.refs;
  const data = {};
  const out = [];

  let splat;
  walk(key, (x, leaf, extra) => {
    if (!root.keys) {
      throw new NotFound(key, x);
    }

    let found;
    root.keys.some(k => {
      const { match, _length, _isSplat } = root[k].pattern;
      const matches = match(_isSplat ? extra || x : x);

      if (matches) {
        const routes = (parent[root[k].route] || [])
          .concat(parent[root[k].route + '/'] || [])
          .concat(parent[root[k].route + '#'] || []);

        Object.assign(data, matches);

        routes.forEach(route => {
          if (!out.some(x => x.key === route)) {
            const routeInfo = { ...parent[route] };

            // properly handle exact-routes!
            let hasMatch = false;

            if (routeInfo.exact) {
              hasMatch = extra === null;
            } else {
              hasMatch = !(x && leaf === null) || x === leaf || _isSplat || !extra;
            }

            routeInfo.matches = hasMatch;
            routeInfo.params = { ...data };
            routeInfo.route = routeInfo.fullpath;
            routeInfo.depth += match.keys.length;
            routeInfo.path = (_isSplat && extra) || leaf || x;

            delete routeInfo.fullpath;
            out.push(routeInfo);
          }
        });

        if (extra === null && !root[k].keys) {
          return true;
        }

        if (!_isSplat && !extra && root.keys.some(x => x.includes('*'))) {
          return false;
        }

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

  return out.sort((a, b) => {
    if (b.fallback && !a.fallback) return -1;
    if (a.fallback && !b.fallback) return 1;
    if (b.route.includes('#') && !a.route.includes('#')) return -1;
    if (a.route.includes('#') && !b.route.includes('#')) return 1;
    return a.depth - b.depth;
  });
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
  const depth = fullpath.split(/(?=[#:/*.]\w)/g).length;
  const params = { ...routeInfo, fullpath, depth };

  if (!path || !'#/'.includes(path.charAt())) {
    throw new TypeError(`Routes should have a valid path, given ${JSON.stringify(path)}`);
  }

  if (!params.key) {
    throw new TypeError(`Routes should have a key, given ${JSON.stringify(params)}`);
  }

  routes.refs[params.key] = params;
  routes.refs[fullpath] = routes.refs[fullpath]
    ? routes.refs[fullpath].concat(params.key)
    : [params.key];

  let root = routes;
  walk(fullpath, (x, leaf) => {
    root = PathMatcher.push(x, root, leaf, fullpath);
  });

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

  if (leaf.route === root.route) {
    delete routes.refs[fullpath];
  }
}
