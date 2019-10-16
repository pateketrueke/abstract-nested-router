import { expect } from 'chai';
import Router from '../src';

/* eslint-disable no-unused-expressions */

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

    expect(routes[1].component).to.eql('Hashed');
    expect(routes[1].route).to.eql('/buzz#:quux');
    expect(routes[1].params).to.eql({ quux: 'bazzinga' });
    expect(routes[1].path).to.eql('/buzz#bazzinga');

    expect(router.find('/buzz#test')[1].component).to.eql('Anchor');
  });

  it('should handle advanced parameters (regex-like)', () => {
    const r = new Router();

    r.add('/v:major<\\d+>(.:minor<\\d+>(.:patch<\\d+>))(-:fragment)(#:branch)');
    expect(r.find('/v1')[1].params).to.eql({
      major: '1',
      minor: null,
      patch: null,
      fragment: null,
      branch: null,
    });
    expect(r.find('/v2.0')[1].params).to.eql({
      major: '2',
      minor: '0',
      patch: null,
      fragment: null,
      branch: null,
    });
    expect(r.find('/v0.5.0-rc17')[1].params).to.eql({
      major: '0',
      minor: '5',
      patch: '0',
      fragment: 'rc17',
      branch: null,
    });
    expect(r.find('/v0.2.1#latest')[1].params).to.eql({
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

  it('should be able to unregister segments', () => {
    router.rm('/');
    expect(router.find('/')).to.eql([]);
    expect(router.find('/test')[0].component).to.eql('Fallback');

    router.rm('/*any');
    router.rm('/foo/:bar');
    expect(router.find('/foo')[0].component).to.eql('JustFoo');
    expect(() => router.find('/foo/bar')).to.throw(/Unreachable/);
    expect(router.find('/foo/nested/something')[2].component).to.eql('NestedValue');
  });

  it('should fail if routes are missing', () => {
    router.rm('/*any');
    expect(() => router.find('/noop')).to.throw(/Unreachable/);
    expect(() => router.rm('/foo/not/exists')).to.throw(/Unreachable/);
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
    expect(r.find('/nested#')[1].route).to.eql('/nested#');
    expect(r.find('/nested#test')[1].route).to.eql('/nested#test');
    expect(r.find('/nested#a/b/c')[2].route).to.eql('/nested#:any/*path');
    expect(r.find('/nested#abc/def/ghi')[2].params.path).to.eql('def/ghi');
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

    expect(r.find('/sub#/about')[1].matches).to.be.false;
    expect(r.find('/sub#/about')[2].matches).to.be.true;
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
        expect(result.length).to.eql(2);
      }
    });

    const chunks = [];

    r.resolve('/a/b/x#z?n=1', (err, result) => {
      expect(err).to.be.null;
      chunks.push(result);
    });

    expect(chunks.length).to.eql(4);
    expect(chunks[0].length).to.eql(2);
    expect(chunks[1].length).to.eql(1);
    expect(chunks[2].length).to.eql(1);
    expect(chunks[3].length).to.eql(4);

    expect(chunks[3][chunks[3].length - 1].params).to.eql({ v: 'x', vv: 'z' });
  });
});
