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
    expect(router.find('/')[1].component).to.eql('Home');
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
    expect(router.find('/')[1].component).to.eql('Fallback');

    router.rm('/foo/:bar');
    expect(router.find('/foo')[1].component).to.eql('JustFoo');
    expect(() => router.find('/foo/bar')).to.throw(/Unreachable/);
    expect(router.find('/foo/nested/something')[3].component).to.eql('NestedValue');
  });

  it('should fail if routes are missing', () => {
    router.rm('/*any');
    expect(() => router.find('/noop')).to.throw(/Unreachable/);
    expect(() => router.rm('/foo/not/exists')).to.throw(/Unreachable/);
  });

  it('should stop on splat params', () => {
    expect(router.find('/a/b/c').length).to.eql(2);
  });
});
