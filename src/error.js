export default class NotFound extends Error {
  constructor(route, path) {
    super(`Unreachable '${route}', segment '${path}' is not defined`);
  }
}
