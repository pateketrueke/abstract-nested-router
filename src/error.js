export default class NotFound extends Error {
  constructor(route, path) {
    const message = `Unreachable '${route}', segment '${path}' is not defined`;

    super(message);
    this.message = message;
  }
}
