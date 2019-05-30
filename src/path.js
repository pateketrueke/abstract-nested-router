export function buildMatcher(path) {
  let regex;
  let _isSplat;
  let _priority = -100;

  const keys = [];

  regex = path
    .replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    .replace(/\\\((.*?)\\\)/g, '(?:$1)?')
    .replace(/\\?([:*]\w+)/g, (_, key) => {
      keys.push(key.substr(1));

      if (key.charAt() === ':') {
        _priority += 100;
        return '((?!#)[^/]+?)';
      }

      _isSplat = true;
      _priority += 500;

      return '((?!#).+?)';
    });

  regex = new RegExp(`^${regex}$`);

  const _hashed = path.includes('#') ? 0.5 : 1;
  const _depth = (path.length * _priority) * _hashed;

  return {
    keys, regex, _depth, _isSplat,
  };
}

export default class PathMatcher {
  constructor(path) {
    const {
      keys, regex, _depth, _isSplat,
    } = buildMatcher(path);

    return {
      _isSplat,
      _depth,
      match: value => {
        const matches = value.match(regex);

        if (matches) {
          return keys.reduce((prev, cur, i) => {
            prev[cur] = decodeURIComponent(matches[i + 1]);
            return prev;
          }, {});
        }
      },
    };
  }

  static push(key, prev, leaf) {
    const root = prev[key] || (prev[key] = {});

    if (!root.pattern) {
      root.pattern = new PathMatcher(key);
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
