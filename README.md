# Abstract Nested Router

> It _tries_ to capture all matching routes from its **root**.
>
> [![Build Status](https://api.travis-ci.org/pateketrueke/abstract-nested-router.svg?branch=master)](https://travis-ci.org/pateketrueke/abstract-nested-router)
> [![NPM version](https://badge.fury.io/js/abstract-nested-router.svg)](http://badge.fury.io/js/abstract-nested-router)
> [![Coverage Status](https://codecov.io/github/pateketrueke/abstract-nested-router/coverage.svg?branch=master)](https://codecov.io/github/pateketrueke/abstract-nested-router)
> [![Known Vulnerabilities](https://snyk.io/test/npm/abstract-nested-router/badge.svg)](https://snyk.io/test/npm/abstract-nested-router)

```js
import Router from 'abstract-nested-router';

const r = new Router();

// single routes
r.add('/', { is: 'home' });
r.add('/*_', { is: 'catch' });

// nested routes
r.mount('/:a', () => {
  r.add('/*_', { is: 'undef' });
  r.add('/:b/:c', { is: 'nested' });
});

r.find('/');
[ { is: 'home', params: {}, route: '/', path: '/' } ]

r.find('/test');
[ { is: 'home', params: {}, route: '/', path: '/' },
  { is: 'undef',
    params: { a: 'test' },
    route: '/:a',
    path: '/test' } ]

r.find('/x/y');
[ { is: 'home', params: {}, route: '/', path: '/' },
  { is: 'undef', params: { a: 'x' }, route: '/:a', path: '/x' },
  { is: 'nested',
    params: { a: 'x', b: 'y' },
    route: '/:a/:b',
    path: '/x/y' } ]

r.find('/x/y/z');
[ { is: 'home', params: {}, route: '/', path: '/' },
  { is: 'undef', params: { a: 'x' }, route: '/:a', path: '/x' },
  { is: 'nested',
    params: { a: 'x', b: 'y' },
    route: '/:a/:b',
    path: '/x/y' },
  { is: 'nested',
    params: { a: 'x', b: 'y', c: 'z' },
    route: '/:a/:b/:c',
    path: '/x/y/z' } ]

r.find('/x/y/z/0');
// Error: Unreachable '/x/y/z/0', segment '/0' is not defined

r.find('/x/y/z/0', true);
[ { is: 'home', params: {}, route: '/', path: '/' },
  { is: 'catch',
    params: { _: 'x/y/z/0' },
    route: '/*_',
    path: '/x/y/z/0' } ]
```

In the latter example `catch` is resolved just after the previous failure of `/x/y/z/0` because we're trying at least twice.

## API

Available methods:

- `mount(path, cb)` &mdash; Allow to register routes under the same route
- `find(path[, retries])` &mdash; Look up routes by path, in case of failure try passing `retries` as true
- `add(path[, routeInfo])` &mdash; Register a single route by path, additional info will be returned on match
- `rm(path)` &mdash; Remove a single route by full-path, it will fail if given route is not registered!
