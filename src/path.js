export function buildMatcher(path, parent) {
  let regex;
  let _isSplat;
  let _priority = -100;

  const keys = [];

  regex = path
    .replace(/[-$.]/g, '\\$&')
    .replace(/\(/g, '(?:')
    .replace(/\)/g, ')?')
    .replace(/([:*]\w+)(?:<([^<>]+?)>)?/g, (_, key, expr) => {
      keys.push(key.substr(1));

      if (key.charAt() === ':') {
        _priority += 100;
        return `((?!#)${expr || '[^#/]+?'})`;
      }

      _isSplat = true;
      _priority += 500;

      return `((?!#)${expr || '[^#]+?'})`;
    });

  try {
    regex = new RegExp(`^${regex}$`);
  } catch (e) {
    throw new TypeError(`Invalid route expression, given '${parent}'`);
  }

  const _hashed = path.includes('#') ? 0.5 : 1;
  const _depth = (path.length * _priority) * _hashed;

  return {
    keys, regex, _depth, _isSplat,
  };
}

export default class PathMatcher {
  constructor(path, parent) {
    const {
      keys, regex, _depth, _isSplat,
    } = buildMatcher(path, parent);

    return {
      _isSplat,
      _depth,
      match: value => {
        const matches = value.match(regex);

        if (matches) {
          return keys.reduce((prev, cur, i) => {
            prev[cur] = typeof matches[i + 1] === 'string' ? decodeURIComponent(matches[i + 1]) : null;
            return prev;
          }, {});
        }
      },
    };
  }

  static push(key, prev, leaf, parent) {
    const root = prev[key] || (prev[key] = {});

    if (!root.pattern) {
      root.pattern = new PathMatcher(key, parent);
      root.route = leaf || '/';
    }

    prev.keys = prev.keys || [];

    if (!prev.keys.includes(key)) {
      prev.keys.push(key);
      PathMatcher.sort(prev);
    }

    return root;
  }

  static sort(root) {
    root.keys.sort((a, b) => {
      return root[a].pattern._depth - root[b].pattern._depth;
    });
  }
}
