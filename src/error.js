export default class extends Error {
  constructor(route, path) {
    const message = `Unreachable '${route !== '/' ? route.replace(/\/$/, '') : route}', segment '${path}' is not defined`;

    super(message);
    this.message = message;
    this.route = route;
    this.path = path;
  }
}
