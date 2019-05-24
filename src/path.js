export function buildMatcher(path, keys = []) {
  let regex = path;
  let _isSplat;

  if (!(path instanceof RegExp)) {
    regex = path
      .replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
      .replace(/\\\((.*?)\\\)/g, '(?:$1)?')
      .replace(/\\?([:*]\w+)/g, (_, key) => {
        keys.push(key.substr(1));

        if (key.charAt() === ':') {
          return '((?!#)[^/]*?)';
        }

        _isSplat = true;

        return '((?!#).*?)';
      });

    regex = new RegExp(`^${regex}${!_isSplat ? '(?:$|\\/.*?)' : ''}$`);
  }

  return [keys, regex, _isSplat];
}

export default class PathMatcher {
  constructor(path, _keys) {
    const [keys, regex, _isSplat] = buildMatcher(path, _keys);

    return {
      _isSplat,
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
}
