# Abstract Nested Router

> It _tries_ to capture all matching routes from its **root**.
>
> [![Build status](https://github.com/pateketrueke/abstract-nested-router/actions/workflows/ci.yml/badge.svg)](https://github.com/pateketrueke/abstract-nested-router/actions/workflows/ci.yml)
> [![NPM version](https://badge.fury.io/js/abstract-nested-router.svg)](http://badge.fury.io/js/abstract-nested-router)
> [![Coverage Status](https://codecov.io/github/pateketrueke/abstract-nested-router/coverage.svg?branch=master)](https://codecov.io/github/pateketrueke/abstract-nested-router)
> [![Known Vulnerabilities](https://snyk.io/test/npm/abstract-nested-router/badge.svg)](https://snyk.io/test/npm/abstract-nested-router)

```js
import Router from 'abstract-nested-router';

const r = new Router();

r.add('/', { key: 'Home' });
r.mount('/', () => {
  r.add('/foo', { key: 'JustFoo' });
  r.mount('/foo', () => {
    r.add('/static', { key: 'StaticOne' });
    r.mount('/nested', () => {
      r.add('/', { key: 'NestedRoot' });
      r.add('/:value', { key: 'NestedValue' });
    });
    r.add('/:bar', { key: 'AndNested' });
  });
  r.add('/baz', { key: 'Baz' });
  r.add('/buzz', { key: 'Buzz' });
  r.mount('/buzz', () => {
    r.add('#test', { key: 'Anchor' });
    r.add('#:quux', { key: 'Hashed' });
  });
  r.add('/*any', { key: 'Fallback' });
});
```

## API

Available methods:

- `resolve(path, cb)` &mdash; Progressively finds and invoke callback with `(err, routes)` as input, useful for third-party integrations, e.g. [yrv](https://www.npmjs.com/package/yrv)
- `mount(path, cb)` &mdash; Allow to register routes under the same route
- `find(path[, retries])` &mdash; Look up routes by path, in case of failure try passing `retries` as true
- `add(path[, routeInfo])` &mdash; Register a single route by path, additional info will be returned on match
- `rm(path)` &mdash; Remove a single route by full-path, it will fail if given route is not registered!

Options:

While `routeInfo` can include anything, but special keys are considered:

- `key` &mdash; Unique identity for any route handler
- `exact` &mdash; Tell if routing should match exactly or not
- `fallback` &mdash; Tell if the route should be used as last resort

### Params

By default all segments are optional, e.g. `/a/:b/:c` matches with `/a`, `/a/x` and `/a/x/y` so you can say `:b` and `:c` are optional parameters.

More advanced cases would require fragments to be optional, e.g. `/:foo(-bar)` matches with `/x` and `/x-bar` because `-bar` is an optional fragment.

In the latter case `params.foo` will always be `x` regardless if `-bar` is appended, if you want to match `bar` then use `/:foo(-:suffix)` instead.

> _Splat_ parameters will consume the rest of the segments/fragments if they're present, e.g. `/x*y` captures anything that begins with `x` and stores it on `params.y` so it matches `/xy`, `/xabc`, `/x/y`, `/x/a/b/c` and so on.

Every parameter can hold simple regex-like patterns, e.g. `/:id<\d+>`

Supported patterns:

- `/:x` and `/*y` are optional segments and they cannot be empty
- `<...>` to hold regex-like patterns, `-$.` are escaped, `/` is forbidden
- `(...)` are used to mark fragments as optional, it translates to `(?:...)?`

> Please avoid `/` inside `(...)` or `<...>` as they will fail loudly!

### Nesting

Consider the following examples:

```js
// 1. regular
r.add('/a');
r.add('/a/:b');
r.add('/a/:b/:c');

// 2. nested
r.mount('/a', () => {
  r.mount('/:b', () => {
    r.add('/:c');
  });
});

// 3. concise
r.add('/a/:b/:c');
```

In the former way (1) we're declaring each route-level by hand, however they can be expressed at once as that latter one (3) which is more concise.

The middle form (2) is a shortcut to produce concise routes.

So which one is the best? It depends on the context:

- Use concise routes to share the same `routeInfo` on all segments, it will be applied only if it's not yet defined on the route.
- Use nested routes to use shared paths, it's convenient for creating stacks of context while mounting routes, etc.
- Use regular routes to gain full control over its definition, this way each route can have its own separated context.

> Routes are sorted and matched by priority and type, routes with splat params will be tried last. As more static and with less parameters the route will be matched sooner!
