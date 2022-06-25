import { expect } from 'chai';
import Router from '../src';

/* eslint-disable no-unused-expressions */

function shuffle(tests) {
  let currentIndex = tests.length, randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    [tests[currentIndex], tests[randomIndex]] = [tests[randomIndex], tests[currentIndex]];
  }
  return tests.forEach(fn => fn());
}

function tail(arr) {
  return arr[arr.length - 1];
}

/* global beforeEach, describe, it */

let router;
describe('smoke-test', () => {
  beforeEach(() => {
    router = new Router();
    router.add('/', { key: 'Home' });
    router.mount('/', () => {
      router.add('/foo', { key: 'JustFoo' });
      router.mount('/foo', () => {
        router.add('/static', { key: 'StaticOne' });
        router.mount('/nested', () => {
          router.add('/', { key: 'NestedRoot' });
          router.add('/:value', { key: 'NestedValue' });
        });
        router.add('/:bar', { key: 'AndNested' });
      });
      router.add('/baz', { key: 'Baz' });
      router.add('/buzz', { key: 'Buzz' });
      router.mount('/buzz', () => {
        router.add('#test', { key: 'Anchor' });
        router.add('#:quux', { key: 'Hashed' });
      });
      router.add('/*any', { key: 'Fallback' });
    });
  });

  it('should match static segments', () => {
    expect(router.find('/')[0].key).to.eql('Home');
    expect(router.find('/foo')[1].key).to.eql('JustFoo');
  });

  it('should match nested segments', () => {
    expect(router.find('/foo/static')[2].key).to.eql('StaticOne');
  });

  it('should match param-segments', () => {
    expect(router.find('/foo/fun')[2].key).to.eql('AndNested');
  });

  it('should match splat-segments', () => {
    expect(router.find('/other')[1].key).to.eql('Fallback');
  });

  it('should stop on splat params', () => {
    expect(router.find('/a/b/c').length).to.eql(2);
  });

  it('should work with hash-based routes', () => {
    const routes = router.find('/buzz#bazzinga');

    expect(routes.length).to.eql(3);
    expect(routes[2].key).to.eql('Hashed');
    expect(routes[2].route).to.eql('/buzz#:quux');
    expect(routes[2].params).to.eql({ quux: 'bazzinga' });
    expect(routes[2].path).to.eql('/buzz#bazzinga');

    expect(router.find('/buzz#test')[2].key).to.eql('Anchor');
  });

  it('should capture all matching routes', () => {
    const routes = router.find('/foo/nested/something');

    expect(routes.length).to.eql(4);
    expect(routes[0].path).to.eql('/');
    expect(routes[1].path).to.eql('/foo');
    expect(routes[2].path).to.eql('/foo/nested');
    expect(routes[3].path).to.eql('/foo/nested/something');
  });

  it('should be able to unregister segments', () => {
    router.rm('/');

    expect(router.find('/')).to.eql([]);

    expect(router.find('/test')).to.eql([
      { key: 'Fallback', depth: 3, matches: true, params: { any: 'test' }, path: '/test', route: '/*any' },
    ]);

    router.rm('/*any');
    router.rm('/foo/:bar');
    expect(router.find('/foo')).to.eql([
      { key: 'JustFoo', depth: 1, matches: true, params: {}, route: '/foo', path: '/foo' },
    ]);

    expect(() => router.find('/foo/bar')).to.throw(/Unreachable/);
    expect(router.find('/foo/nested/something')[2].key).to.eql('NestedValue');
  });

  it('should fail if routes are missing', () => {
    router.rm('/*any');
    expect(() => router.find('/noop')).to.throw(/Unreachable/);
    expect(() => router.rm('/foo/not/exists')).to.throw(/Unreachable/);
  });
});

describe('integration', () => {
  it('should register any routes through add()', () => {
    const r = new Router();

    r.mount('/', () => {
      shuffle([
        () => r.add('/', { key: 'home' }),
        () => r.add('/', { fallback: true, key: '404' }),
        () => r.add('/:x', { key: 'x' }),
        () => r.add('/:x/*any', { key: 'any' }),
      ]);
    });

    expect(r.find('/x')).to.eql([
      { key: 'home', matches: true, params: {}, depth: 1, route: '/', path: '/' },
      { key: 'x', matches: true, params: { x: 'x' }, depth: 3, route: '/:x', path: '/x' },
      { key: '404', matches: true, fallback: true, params: {}, depth: 1, route: '/', path: '/' },
    ]);
  });

  it('should pick the best matches on find()', () => {
    const r = new Router();

    r.mount('/', () => {
      shuffle([
        () => r.add('/', { exact: true, key: 'home' }),
        () => r.add('/players', { key: 'play' }),
        () => r.add('/', { fallback: true, key: '404' }),
      ]);
    });

    expect(r.find('/')).to.eql([
      {
        matches: true,
        exact: true,
        depth: 1,
        key: 'home',
        params: {},
        route: '/',
        path: '/',
      },
      {
        matches: true,
        fallback: true,
        depth: 1,
        key: '404',
        params: {},
        route: '/',
        path: '/',
      }
    ]);
    expect(() => r.find('/x')).to.throw(/Unreachable/);

    r.rm('/');
    expect(r.find('/players')).to.eql([
      {
        matches: true,
        params: {},
        depth: 1,
        route: '/players',
        path: '/players',
        key: 'play',
      }
    ]);

    r.mount('/', () => {
      r.add('/', { fallback: true, key: 'ask' });
    });

    expect(r.find('/')).to.eql([
      {
        fallback: true,
        matches: true,
        depth: 1,
        key: 'ask',
        params: {},
        route: '/',
        path: '/',
      }
    ]);
    expect(() => r.find('/x')).to.throw(/Unreachable/);
  });

  it('should match routes with trailing-slash as root', () => {
    const r = new Router();

    r.mount('/', () => {
      shuffle([
        () => r.add('/', { key: 'r0', exact: true }),
        () => r.add('/:x', { key: 'p0' }),
        () => r.add('/:x/', { key: 'p1' }),
      ]);
    });

    const a = r.find('/sub/');
    const b = [];

    r.resolve('/sub', (err, result) => b.push(...result));

    expect(a.length).to.eql(3);
    expect(a[0].key).to.eql('r0');
    expect(a[1].key).to.eql('p0');
    expect(a[2].key).to.eql('p1');

    expect(b.length).to.eql(3);
    expect(a.map(x => x.key)).to.eql(b.map(x => x.key));

    r.rm('/:x/');
    expect(r.find('/sub').length).to.eql(2);
    expect(r.find('/sub')[1].key).to.eql('p0');
  });

  it('should handle advanced parameters (regex-like)', () => {
    const r = new Router();

    r.mount('/v:major<\\d+>(.:minor<\\d+>(.:patch<\\d+>))(-:fragment)', () => {
      r.add('#', { key: 'log' });
      r.add('#:branch', { key: 'branch' });
    });

    expect(r.find('/v1#x').length).to.eql(2);
    expect(r.find('/v1')[0].params).to.eql({
      major: '1',
      minor: null,
      patch: null,
      fragment: null,
    });
    expect(r.find('/v2.0')[0].params).to.eql({
      major: '2',
      minor: '0',
      patch: null,
      fragment: null,
    });
    expect(r.find('/v0.5.0-rc17')[0].params).to.eql({
      major: '0',
      minor: '5',
      patch: '0',
      fragment: 'rc17',
    });
    expect(r.find('/v0.2.1#latest')[0].params).to.eql({
      major: '0',
      minor: '2',
      patch: '1',
      fragment: null,
      branch: 'latest',
    });

    expect(() => r.add('/x:y<a/b>', { key: 'err' })).to.throw(/cannot contain slashes/);
    expect(() => r.add('/:foo(/:bar)', { key: 'nope' })).to.throw(/Invalid route expression/);
  });

  it('should allow to upgrade routes', () => {
    const r = new Router();

    let fullpath;
    r.mount('/auth', () => r.add('/', { key: 'old' }));

    expect(r.find('/auth')).to.eql([
      { key: 'old', depth: 1, matches: true, params: {}, route: '/auth/', path: '/auth' },
    ]);

    r.rm('/auth/');
    r.mount('/auth', () => r.add('/', { key: 'new' }));

    expect(r.find('/auth')).to.eql([
      { key: 'new', depth: 1, matches: true, params: {}, route: '/auth/', path: '/auth' },
    ]);
  });

  it('should remove specific routes only', () => {
    const r = new Router();

    r.mount('/test', () => r.add('/', { key: 'test' }));
    r.mount('/test', () => r.add('/props', { key: 'props' }));
    r.mount('/test', () => r.add('/failed', { key: 'failed' }));

    expect(tail(r.find('/test'))).to.eql({
      key: 'test',
      depth: 1,
      matches: true,
      params: {},
      route: '/test/',
      path: '/test',
    });

    expect(tail(r.find('/test/failed'))).to.eql({
      key: 'failed',
      depth: 2,
      matches: true,
      params: {},
      route: '/test/failed',
      path: '/test/failed',
    });

    r.rm('/test/failed');

    expect(() => r.find('/test/failed')).to.throw(/Unreachable/);

    expect(tail(r.find('/test/props'))).to.eql({
      key: 'props',
      depth: 2,
      matches: true,
      params: {},
      route: '/test/props',
      path: '/test/props',
    });

    expect(tail(r.find('/test'))).to.eql({
      key: 'test',
      depth: 1,
      matches: true,
      params: {},
      route: '/test/',
      path: '/test',
    });
  });

  it('should handle sorting', () => {
    const r = new Router();

    shuffle([
      () => r.mount('/nested', () => r.add('/', { key: 'empty' })),
      () => r.mount('/', () => r.add('/slot', { key: 1 })),
      () => r.mount('/', () => r.add('/admin-true', { key: 2 })),
      () => r.mount('/', () => r.add('/admin-false', { key: 3 })),
      () => r.mount('/', () => r.add('/user/:name/:age', { key: 4 })),
      () => r.mount('/', () => r.add('/user/:name', { key: 5 })),
      () => r.mount('/', () => r.add('/about', { key: 6 })),
      () => r.mount('/', () => r.add('/company', { key: 7 })),
      () => r.mount('/', () => r.add('/', { key: 8 })),
      () => r.mount('/', () => r.add('/*_', { key: 9, fallback: true })),
    ]);

    r.mount('/', () => r.add('#*_', { key: '#', fallback: true }));
    r.mount('/nested', () => r.add('#', { key: 10 }));
    r.mount('/nested', () => r.add('#test', { key: 11 }));
    r.mount('/nested', () => r.add('#:any', { key: 12 }));
    r.mount('/nested', () => r.add('#:any/*path', { key: 13 }));

    expect(() => r.find('#')).to.throw(/Unreachable/);
    expect(() => {
      r.find('/');
      r.find('/#whatever');
    }).not.to.throw();

    expect(r.find('/user')[1].path).to.eql('/user');
    expect(r.find('/user/john')[1].route).to.eql('/user/:name');
    expect(r.find('/user/john/33')[2].route).to.eql('/user/:name/:age');

    expect(r.find('/nested').length).to.eql(4);
    expect(r.find('/nested')[1].route).to.eql('/nested/');
    expect(r.find('/nested')[2].route).to.eql('/nested#');
    expect(r.find('/nested')[3].route).to.eql('/*_');
    expect(r.find('/nested#')[1].route).to.eql('/nested/');
    expect(r.find('/nested#')[2].route).to.eql('/nested#');
    expect(r.find('/nested#test')[3].route).to.eql('/nested#test');
    expect(r.find('/nested#a/b/c')[4].route).to.eql('/nested#:any/*path');
    expect(r.find('/nested#abc/def/ghi')[4].params.path).to.eql('def/ghi');
    expect(() => r.find('/nested/wooot')).to.throw(/Unreachable/);

    r.mount('/x', () => {
      r.add('/a', { key: 'a' });
      r.add('/abc', { key: 'b' });
      r.add('/:value', { key: 'c' });
    });

    expect(r.find('/x')[1].route).to.eql('/*_');
    expect(r.find('/x/a')[1].route).to.eql('/x/a');
    expect(r.find('/x/ab')[1].route).to.eql('/x/:value');
    expect(r.find('/x/abc')[1].route).to.eql('/x/abc');
    expect(r.find('/x/abcd')[1].route).to.eql('/x/:value');
  });

  it('should handle retries', () => {
    const r = new Router();

    r.add('/', { key: 'home' });
    r.add('/*_', { key: 'catch' });

    r.mount('/:a', () => {
      r.add('/*_', { key: 'undef' });
      r.add('/:b/:c', { key: 'nested' });
    });

    expect(r.find('/')[0].key).to.eql('home');
    expect(r.find('/x')[1].key).to.eql('catch');
    expect(r.find('/x/y')[1].key).to.eql('undef');
    expect(r.find('/x/y/z')[1].key).to.eql('nested');
    expect(() => r.find('/x/y/z/0')).to.throw(/Unreachable/);
    expect(() => r.rm('/:a/:b/:c/:d')).to.throw(/Unreachable/);
    expect(() => r.find('/x/y/z/0', true)).to.throw(/Unreachable/);
  });

  it('should report exact matches', () => {
    const r = new Router();

    r.add('/', { key: 1 });
    r.add('/*_', { key: 2 });
    r.add('/test', { key: 3 });

    expect(r.find('/')[0].matches).to.be.true;
    expect(r.find('/x')[1].matches).to.be.true;
    expect(r.find('/test')[1].matches).to.be.true;
  });

  it('should load exact routes only', () => {
    const r = new Router();

    r.mount('/', () => {
      r.add('/', { exact: true, key: 'home' });
      r.add('/list', { exact: true, key: 'list' });
      r.add('/list/add', { exact: true, key: 'add' });
    });

    const filter = x => r.find(x).filter(y => !(y.exact && !y.matches));

    expect(filter('/').length).to.eql(1);
    expect(filter('/list').length).to.eql(1);
    expect(filter('/list/add').length).to.eql(1);
  });

  it('should discard non-exact matches', () => {
    const r = new Router();

    r.mount('/sub', () => {
      r.add('#', { exact: true, key: 'home' });
      r.add('#/about', { exact: true, key: 'about' });
    });

    expect(r.find('/sub#/about')[0].matches).to.be.false;
    expect(r.find('/sub#/about')[1].matches).to.be.true;
  });

  it('should match all optional segments', () => {
    const r = new Router();

    shuffle([
      () => r.mount('/page', () => r.add('/:a/:b', { key: 'b' })),
      () => r.mount('/page', () => r.add('/:a', { key: 'a' })),
      () => r.mount('/page', () => r.add('/', { key: 'x' })),
    ]);

    expect(r.find('/page/1/edit').length).to.eql(3);
    expect(r.find('/page/1/edit')[0].key).to.eql('x');
    expect(r.find('/page/1/edit')[1].key).to.eql('a');
    expect(r.find('/page/1/edit')[2].key).to.eql('b');
  });

  it('should resolve paths starting from root', () => {
    const r = new Router();

    r.add('/a', { key: 1 });
    r.mount('/a', () => {
      r.add('/b', { key: 2 });
      r.mount('/b', () => {
        r.add('/:v', { key: 3 });
        r.mount('/:v', () => {
          r.add('#:vv', { key: 4 });
        });
      });
    });

    r.resolve('//', (err, result) => {
      expect(err).to.be.null;
    });

    r.resolve('/a//b', (err, result, fullpath) => {
      if (err) {
        expect(err.message).to.match(/Unreachable/);
      } else if (fullpath !== '/') {
        expect(result.length).to.eql(1);
      }
    });

    const chunks = [];

    r.resolve('/a/b/x#z?n=1', (err, result) => {
      expect(err).to.be.null;
      chunks.push(result);
    });

    expect(chunks.length).to.eql(5);
    expect(chunks[0].length).to.eql(0);
    expect(chunks[1].length).to.eql(1);
    expect(chunks[2].length).to.eql(1);
    expect(chunks[3].length).to.eql(1);

    expect(chunks[4][chunks[4].length - 1].params).to.eql({ v: 'x', vv: 'z' });
  });

  it('should take root-info from first defined route ', () => {
    const r1 = new Router();

    r1.mount('/example', () => {
      shuffle([
        () => r1.add('/', { key: 'root', exact: true }),
        () => r1.add('/*_', { key: 'fallback' }),
        () => r1.add('/:name', { key: 'value' }),
      ]);
    })

    expect(r1.find('/example/a')[0].key).to.eql('root');
    expect(r1.find('/example/a')[0].matches).to.be.false;
    expect(() => r1.find('/example/a/b')).to.throw(/Unreachable/);

    const r2 = new Router();

    r2.mount('/example', () => {
      shuffle([
        () => r2.add('/*_', { key: 'fallback' }),
        () => r2.add('/', { key: 'root' }),
        () => r2.add('/:name', { key: 'value' }),
      ]);
    })

    expect(r2.find('/example/a')[0].key).to.eql('root');
    expect(r2.find('/example/a')[1].key).to.eql('value');
    expect(() => r2.find('/example/a/b')).to.throw(/Unreachable/);

    const r3 = new Router();

    r3.mount('/', () => {
      shuffle([
        () => r3.add('/password-recovery', { exact: true, key: 'recovery' }),
        () => r3.add('/login', { exact: true, key: 'login' }),
        () => r3.add('/', { exact: null, key: 'root' }),
      ]);
    });

    expect(r3.find('/login')[0].matches).to.be.true;
    expect(r3.find('/login')[1].matches).to.be.true;
  });

  it('should drop inherited-keys to preserve uniqueness', () => {
    const r = new Router();

    r.mount('/top', () => {
      shuffle([
        () => r.add('/foo/a', { key: 'a' }),
        () => r.add('/bar/b', { key: 'b' }),
        () => r.add('/bar/c', { key: 'c' }),
      ]);
    });

    const routes = [];

    r.resolve('/top/bar/c', (err, result) => routes.push(...result));

    expect(routes).to.eql([
      { depth: 3, matches: true, params: {}, route: '/top/bar/c', path: '/top/bar/c', key: 'c' },
    ]);
  });

  it('should discard non-matching leafs', () => {
    const r = new Router();

    r.mount('/sub', () => {
      r.add('/', { key: 'sub' });
      r.add('#', { key: 'hash' });
      r.add('#/about', { key: 'about' });
    });

    r.mount('/test', () => {
      shuffle([
        () => r.add('/', { key: 'test' }),
        () => r.add('/props', { key: 'props' }),
        () => r.add('/props/:value', { key: 'value' }),
      ]);
    });

    expect(r.find('/sub')).to.eql([
      { depth: 1, matches: true, params: {}, route: '/sub/', path: '/sub', key: 'sub' },
      { depth: 1, matches: true, params: {}, route: '/sub#', path: '/sub', key: 'hash' },
    ]);

    expect(r.find('/sub#')).to.eql([
      { depth: 1, matches: true, params: {}, route: '/sub/', path: '/sub', key: 'sub' },
      { depth: 1, matches: true, params: {}, route: '/sub#', path: '/sub', key: 'hash' },
    ]);

    expect(r.find('/sub#/about')).to.eql([
      { depth: 1, matches: true, params: {}, route: '/sub/', path: '/sub', key: 'sub' },
      { depth: 1, matches: true, params: {}, route: '/sub#', path: '/sub', key: 'hash' },
      { depth: 2, matches: true, params: {}, route: '/sub#/about', path: '/sub#/about', key: 'about' },
    ]);

    expect(r.find('/test')).to.eql([
      { depth: 1, matches: true, params: {}, route: '/test/', path: '/test', key: 'test' },
    ]);

    expect(r.find('/test/props')).to.eql([
      { depth: 1, matches: true, params: {}, route: '/test/', path: '/test', key: 'test' },
      { depth: 2, matches: true, params: {}, route: '/test/props', path: '/test/props', key: 'props' },
    ]);

    expect(r.find('/test/props/Hello%20world')).to.eql([
      { depth: 1, matches: true, params: {}, route: '/test/', path: '/test', key: 'test' },
      { depth: 2, matches: true, params: {}, route: '/test/props', path: '/test/props', key: 'props' },
      { depth: 4,
        matches: true,
        params: { value: 'Hello world' },
        route: '/test/props/:value',
        path: '/test/props/Hello%20world',
        key: 'value',
      },
    ]);
  });

  it('should handle nested routes within anchors', () => {
    const r = new Router();

    r.mount('/gist', () => {
      r.add('/', { key: 'main', exact: true });
      r.mount('#:sha1', () => {
        shuffle([
          () => r.add('/', { key: 'show' }),
          () => r.add('/edit', { key: 'edit' }),
          () => r.add('/save', { key: 'save' }),
        ]);
      });
    });

    expect(r.find('/gist').length).to.eql(1);
    expect(r.find('/gist#v1').length).to.eql(2);
    expect(r.find('/gist#v1/edit').length).to.eql(3);
    expect(r.find('/gist#v1/edit')).to.eql([
      { key: 'main', exact: true, matches: false, params: {}, depth: 1, route: '/gist/', path: '/gist' },
      { key: 'show', matches: true, params: { sha1: 'v1' }, depth: 3, route: '/gist#:sha1/', path: '/gist#v1' },
      { key: 'edit', matches: true, params: { sha1: 'v1' }, depth: 3, route: '/gist#:sha1/edit', path: '/gist#v1/edit' },
    ]);
  });

  it('should handle nested anchors within routes', () => {
    const r = new Router();

    r.mount('/sub', () => {
      shuffle([
        () => r.add('/', { key: 'sub' }),
        () => r.add('#', { key: 'home', exact: true }),
        () => r.add('#/about', { key: 'about', exact: true }),
      ]);
    });

    expect(r.find('/sub').length).to.eql(2);
    expect(r.find('/sub#').length).to.eql(2);
    expect(r.find('/sub#/about').length).to.eql(3);
    expect(r.find('/sub#/about')).to.eql([
      { depth: 1, key: 'sub', matches: true, params: {}, path: '/sub', route: '/sub/' },
      { depth: 1, exact: true, key: 'home', matches: false, params: {}, path: '/sub', route: '/sub#' },
      { depth: 2, exact: true, key: 'about', matches: true, params: {}, path: '/sub#/about', route: '/sub#/about' },
    ]);
  });
});
