import { expect } from 'chai';
import Router from '../src';

/* global beforeEach, describe, it */

let router;

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
});
