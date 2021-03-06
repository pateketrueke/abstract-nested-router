import { expect } from 'chai';
import Router from '../src';

/* eslint-disable no-unused-expressions */

function resolve(router, fullpath) {
  const output = [];

  router.resolve(fullpath, (err, result) => {
    if (err) throw err;
    output.push(...result);
  });

  return output;
}

function tail(arr) {
  return arr[arr.length - 1];
}

let router;

/* global beforeEach, describe, it */

describe('DSL', () => {
  beforeEach(() => {
    router = new Router();
    router.add('/', { component: 'Home' });
    router.mount('/', () => {
      router.add('/foo', { component: 'JustFoo' });
      router.mount('/foo', () => {
        router.add('/static', { component: 'StaticOne' });
        router.mount('/nested', () => {
          router.add('/:value', { component: 'NestedValue' });
        });
        router.add('/:bar', { component: 'AndNested' });
      });
      router.add('/baz', { component: 'Baz' });
      router.add('/buzz', { component: 'Buzz' });
      router.mount('/buzz', () => {
        router.add('#test', { component: 'Anchor' });
        router.add('#:quux', { component: 'Hashed' });
      });
      router.add('/*any', { component: 'Fallback' });
    });
  });

  it('should match static segments', () => {
    expect(router.find('/')[0].component).to.eql('Home');
    expect(router.find('/foo')[1].component).to.eql('JustFoo');
  });

  it('should match nested segments', () => {
    expect(router.find('/foo/static')[2].component).to.eql('StaticOne');
  });

  it('should match param-segments', () => {
    expect(router.find('/foo/fun')[2].component).to.eql('AndNested');
  });

  it('should match splat-segments', () => {
    expect(router.find('/other')[1].component).to.eql('Fallback');
  });

  it('should work with hash-based routes', () => {
    const routes = router.find('/buzz#bazzinga');
    const output = resolve(router, '/buzz#bazzinga');

    expect(routes).to.eql(output);
    expect(routes[2].component).to.eql('Hashed');
    expect(routes[2].route).to.eql('/buzz#:quux');
    expect(routes[2].params).to.eql({ quux: 'bazzinga' });
    expect(routes[2].path).to.eql('/buzz#bazzinga');

    expect(router.find('/buzz#test')[2].component).to.eql('Anchor');
  });

  it('should handle advanced parameters (regex-like)', () => {
    const r = new Router();

    r.add('/v:major<\\d+>(.:minor<\\d+>(.:patch<\\d+>))(-:fragment)#:branch');
    expect(r.find('/v1')[1].params).to.eql({
      major: '1',
      minor: null,
      patch: null,
      fragment: null,
    });
    expect(r.find('/v2.0')[1].params).to.eql({
      major: '2',
      minor: '0',
      patch: null,
      fragment: null,
    });
    expect(r.find('/v0.5.0-rc17')[1].params).to.eql({
      major: '0',
      minor: '5',
      patch: '0',
      fragment: 'rc17',
    });
    expect(r.find('/v0.2.1#latest')[2].params).to.eql({
      major: '0',
      minor: '2',
      patch: '1',
      fragment: null,
      branch: 'latest',
    });

    expect(() => r.add('/x:y<a/b>')).to.throw(/cannot contain slashes/);
    expect(() => r.add('/:foo(/:bar)')).to.throw(/Invalid route expression/);
  });

  it('should capture all matching routes', () => {
    const routes = router.find('/foo/nested/something');

    expect(routes.length).to.eql(4);
    expect(routes[0].path).to.eql('/');
    expect(routes[1].path).to.eql('/foo');
    expect(routes[2].path).to.eql('/foo/nested');
    expect(routes[3].path).to.eql('/foo/nested/something');
  });

  it('should match routes with trailing-slash as root', () => {
    const r = new Router();

    r.mount('/', () => r.add('/', { key: 'r0', nested: true, exact: true }));
    r.mount('/', () => r.add('/players', { key: 'p0', nested: true }));
    r.mount('/', () => r.add('/players/', { key: 'p1', nested: true }));

    const a = r.find('/players/');
    const b = [];

    r.resolve('/players/', (err, result) => b.push(...result));

    expect(a.length).to.eql(3);
    expect(b.length).to.eql(3);
    expect(a.map(x => x.key)).to.eql(a.map(x => x.key));

    expect(r.find('/players')[1].key).to.eql('p0');

    r.rm('/players/');

    expect(r.find('/players')[1].key).to.eql('p0');
  });

  it('should be able to unregister segments', () => {
    router.rm('/');

    expect(router.find('/')).to.eql([
      { matches: true, params: {}, path: '/', route: '/' },
    ]);

    expect(router.find('/test')).to.eql([
      { matches: true, params: {}, path: '/', route: '/' },
      { component: 'Fallback', matches: true, params: { any: 'test' }, path: '/test', route: '/*any' },
    ]);

    router.rm('/*any');
    router.rm('/foo/:bar');
    expect(router.find('/foo')).to.eql([
      { matches: true, params: {}, route: '/', path: '/' },
      { component: 'JustFoo', matches: true, params: {}, route: '/foo', path: '/foo' },
    ]);

    expect(() => router.find('/foo/bar')).to.throw(/Unreachable/);
    expect(router.find('/foo/nested/something')[2].component).to.eql('NestedValue');
  });

  it('should fail if routes are missing', () => {
    router.rm('/*any');
    expect(() => router.find('/noop')).to.throw(/Unreachable/);
    expect(() => router.rm('/foo/not/exists')).to.throw(/Unreachable/);
  });

  it('should allow to upgrade routes', () => {
    const r = new Router();

    let fullpath;

    r.mount('/auth', () => r.add('/', { is: 'old' }));

    expect(r.find('/auth')).to.eql([
      { matches: true, params: {}, route: '/', path: '/' },
      { is: 'old', matches: true, params: {}, route: '/auth', path: '/auth' },
    ]);

    r.rm('/auth/');

    r.mount('/auth', () => r.add('/', { is: 'new' }));

    expect(r.find('/auth')).to.eql([
      { matches: true, params: {}, route: '/', path: '/' },
      { is: 'new', matches: true, params: {}, route: '/auth', path: '/auth' },
    ]);
  });

  it('should remove specific routes only', () => {
    const r = new Router();

    r.mount('/test', () => r.add('/', { key: 'test', nested: true }));
    r.mount('/test', () => r.add('/props', { key: 'props', nested: true }));
    r.mount('/test', () => r.add('/failed', { key: 'failed', nested: true }));

    expect(tail(r.find('/test'))).to.eql({
      key: 'test',
      nested: true,
      matches: true,
      params: {},
      route: '/test',
      path: '/test',
    });

    expect(tail(r.find('/test/failed'))).to.eql({
      key: 'failed',
      nested: true,
      matches: true,
      params: {},
      route: '/test/failed',
      path: '/test/failed',
    });

    r.rm('/test/failed');

    expect(() => r.find('/test/failed')).to.throw(/Unreachable/);

    expect(tail(r.find('/test/props'))).to.eql({
      key: 'props',
      nested: true,
      matches: true,
      params: {},
      route: '/test/props',
      path: '/test/props',
    });

    expect(tail(r.find('/test'))).to.eql({
      key: 'test',
      nested: true,
      matches: true,
      params: {},
      route: '/test',
      path: '/test',
    });
  });

  it('should stop on splat params', () => {
    expect(router.find('/a/b/c').length).to.eql(2);
  });

  it('should handle sorting', () => {
    const r = new Router();

    r.mount('/', () => r.add('/#*_'));
    r.mount('/nested', () => r.add());
    r.mount('/', () => r.add('/slot'));
    r.mount('/', () => r.add('/admin-true'));
    r.mount('/', () => r.add('/admin-false'));
    r.mount('/', () => r.add('/user/:name/:age'));
    r.mount('/', () => r.add('/user/:name'));
    r.mount('/', () => r.add('/about'));
    r.mount('/', () => r.add('/company'));
    r.mount('/', () => r.add('/'));
    r.mount('/', () => r.add('/*_'));
    r.mount('/nested', () => r.add('#'));
    r.mount('/nested', () => r.add('#test'));
    r.mount('/nested', () => r.add('#:any'));
    r.mount('/nested', () => r.add('#:any/*path'));

    expect(() => r.find('#')).to.throw(/Unreachable/);
    expect(() => {
      r.find('/');
      r.find('/#whatever');
    }).not.to.throw();

    expect(r.find('/user')[1].path).to.eql('/user');
    expect(r.find('/user/john')[2].route).to.eql('/user/:name');
    expect(r.find('/user/john/33')[3].route).to.eql('/user/:name/:age');

    expect(r.find('/nested')[1].route).to.eql('/nested');
    expect(r.find('/nested#')[1].route).to.eql('/nested');
    expect(r.find('/nested#')[2].route).to.eql('/nested#');
    expect(r.find('/nested#test')[2].route).to.eql('/nested#test');
    expect(r.find('/nested#a/b/c')[3].route).to.eql('/nested#:any/*path');
    expect(r.find('/nested#abc/def/ghi')[3].params.path).to.eql('def/ghi');
    expect(() => r.find('/nested/wooot')).to.throw(/Unreachable/);

    r.mount('/x', () => {
      r.add('/a');
      r.add('/abc');
      r.add('/:value');
    });

    expect(r.find('/x')[1].route).to.eql('/x');
    expect(r.find('/x/a')[2].route).to.eql('/x/a');
    expect(r.find('/x/ab')[2].route).to.eql('/x/:value');
    expect(r.find('/x/abc')[2].route).to.eql('/x/abc');
    expect(r.find('/x/abcd')[2].route).to.eql('/x/:value');
  });

  it('should handle retries', () => {
    const r = new Router();

    r.add('/', { is: 'home' });
    r.add('/*_', { is: 'catch' });

    r.mount('/:a', () => {
      r.add('/*_', { is: 'undef' });
      r.add('/:b/:c', { is: 'nested' });
    });

    expect(r.find('/')[0].is).to.eql('home');
    expect(r.find('/test')[1].is).to.eql('undef');
    expect(r.find('/x/y')[2].is).to.eql('nested');
    expect(r.find('/x/y/z')[3].is).to.eql('nested');
    expect(() => r.find('/x/y/z/0')).to.throw(/Unreachable/);
    expect(r.find('/x/y/z/0', true)[1].is).to.eql('catch');
    expect(() => r.rm('/:a/:b/:c/:d')).to.throw(/Unreachable/);
  });

  it('should report exact matches', () => {
    const r = new Router();

    r.add('/');
    r.add('/*_');
    r.add('/test');

    expect(r.find('/')[0].matches).to.be.true;
    expect(r.find('/x')[1].matches).to.be.true;
    expect(r.find('/test')[1].matches).to.be.true;
  });

  it('should load exact routes only', () => {
    const r = new Router();

    r.mount('/', () => {
      r.add('/', { exact: true, is: 'home' });
      r.add('/list', { exact: true, is: 'list' });
      r.add('/list/add', { exact: true, is: 'add' });
    });

    const filter = x => r.find(x).filter(y => !(y.exact && !y.matches));

    expect(filter('/').length).to.eql(1);
    expect(filter('/list').length).to.eql(1);
    expect(filter('/list/add').length).to.eql(1);
  });

  it('should discard non-exact matches', () => {
    const r = new Router();

    r.mount('/sub', () => {
      r.add('#', { exact: true, is: 'home' });
      r.add('#/about', { exact: true, is: 'about' });
    });

    expect(r.find('/sub#/about')[2].matches).to.be.false;
    expect(r.find('/sub#/about')[3].matches).to.be.true;
  });

  it('should resolve paths starting from root', () => {
    const r = new Router();

    r.add('/a');
    r.mount('/a', () => {
      r.add('/b');
      r.mount('/b', () => {
        r.add('/:v');
        r.mount('/:v', () => {
          r.add('#:vv');
        });
      });
    });

    r.resolve('//', (err, result) => {
      expect(err).to.be.null;
    });

    r.resolve('/a//b', (err, result) => {
      if (err) {
        expect(err.message).to.match(/Unreachable/);
      } else {
        expect(result.length).to.eql(1);
      }
    });

    const chunks = [];

    r.resolve('/a/b/x#z?n=1', (err, result) => {
      expect(err).to.be.null;
      chunks.push(result);
    });

    expect(chunks.length).to.eql(5);
    expect(chunks[0].length).to.eql(1);
    expect(chunks[1].length).to.eql(1);
    expect(chunks[2].length).to.eql(1);
    expect(chunks[3].length).to.eql(1);

    expect(chunks[4][chunks[4].length - 1].params).to.eql({ v: 'x', vv: 'z' });
  });

  it('should take root-info from first defined route ', () => {
    const r1 = new Router();

    r1.mount('/example', () => r1.add('/', { is: 'root', exact: true }))
    r1.mount('/example', () => r1.add('/*_', { is: 'fallback' }))
    r1.mount('/example', () => r1.add('/:name', { is: 'value' }))

    expect(r1.find('/example/a')[1].is).to.eql('root');
    expect(r1.find('/example/a')[1].matches).to.be.false;
    expect(() => r1.find('/example/a/b')).to.throw(/Unreachable/);

    const r2 = new Router();

    r2.mount('/example', () => r2.add('/*_', { is: 'fallback' }))
    r2.mount('/example', () => r2.add('/', { is: 'root' }))
    r2.mount('/example', () => r2.add('/:name', { is: 'value' }))

    expect(r2.find('/example/a')[1].is).to.eql('fallback');
    expect(() => r2.find('/example/a/b')).to.throw(/Unreachable/);

    const r3 = new Router();

    r3.mount('/', () => r3.add('/password-recovery', { exact: true, is: 'recovery' }));
    r3.mount('/', () => r3.add('/login', { exact: true, is: 'login' }));
    r3.mount('/', () => r3.add('/', { exact: null, is: 'root' }));

    expect(r3.find('/login')[0].matches).to.be.true;
    expect(r3.find('/login')[1].matches).to.be.true;
  });

  it('should drop inherited-keys to preserve uniqueness', () => {
    const r = new Router();

    r.mount('/top', () => r.add('/foo/a', { key: 'a' }));
    r.mount('/top', () => r.add('/bar/b', { key: 'b' }));
    r.mount('/top', () => r.add('/bar/c', { key: 'c' }));

    const routes = [];

    r.resolve('/top/bar/c', (err, result) => routes.push(...result));

    expect(routes).to.eql([
      { matches: true, params: {}, route: '/', path: '/' },
      { matches: true, params: {}, route: '/top', path: '/top' },
      { matches: true, params: {}, route: '/top/bar', path: '/top/bar' },
      { matches: true, params: {}, route: '/top/bar/c', path: '/top/bar/c', key: 'c' },
    ]);
  });

  it('should discard non-matching leafs', () => {
    const r = new Router();

    r.mount('/sub', () => r.add('/', { key: 'sub' }));
    r.mount('/sub', () => r.add('#', { key: 'hash' }));
    r.mount('/sub', () => r.add('#/about', { key: 'about' }));

    r.mount('/test', () => r.add('/', { key: 'test' }));
    r.mount('/test', () => r.add('/props', { key: 'props' }));
    r.mount('/test', () => r.add('/props/:value', { key: 'value' }));

    expect(r.find('/sub')).to.eql([
      { matches: true, params: {}, route: '/', path: '/' },
      { matches: true, params: {}, route: '/sub', path: '/sub' },
    ]);

    expect(r.find('/sub#')).to.eql([
      { matches: true, params: {}, route: '/', path: '/' },
      { matches: true, params: {}, route: '/sub', path: '/sub' },
      { key: 'hash', matches: true, params: {}, route: '/sub#', path: '/sub#' },
    ]);

    expect(r.find('/sub#/about')).to.eql([
      { matches: true, params: {}, route: '/', path: '/' },
      { matches: true, params: {}, route: '/sub', path: '/sub' },
      { key: 'hash', matches: true, params: {}, route: '/sub#', path: '/sub#' },
      { key: 'about', matches: true, params: {}, route: '/sub#/about', path: '/sub#/about' },
    ]);

    expect(r.find('/test')).to.eql([
      { matches: true, params: {}, route: '/', path: '/' },
      { matches: true, params: {}, route: '/test', path: '/test' },
    ]);

    expect(r.find('/test/props')).to.eql([
      { matches: true, params: {}, route: '/', path: '/' },
      { matches: true, params: {}, route: '/test', path: '/test' },
      { key: 'props', matches: true, params: {}, route: '/test/props', path: '/test/props' },
    ]);

    expect(r.find('/test/props/Hello%20world')).to.eql([
      { matches: true, params: {}, route: '/', path: '/' },
      { matches: true, params: {}, route: '/test', path: '/test' },
      { key: 'props', matches: true, params: {}, route: '/test/props', path: '/test/props' },
      { key: 'value',
        matches: true,
        params: { value: 'Hello world' },
        route: '/test/props/:value',
        path: '/test/props/Hello%20world',
      },
    ]);
  });
});
