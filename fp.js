(function (global) {
  'use strict';

  function just(value) {
    return {
      _tag: 'Just',
      map: function (fn) {
        return just(fn(value));
      },
      chain: function (fn) {
        return fn(value);
      },
      getOrElse: function () {
        return value;
      },
      match: function (cases) {
        return cases.just(value);
      }
    };
  }

  function nothing() {
    return {
      _tag: 'Nothing',
      map: function () {
        return nothing();
      },
      chain: function () {
        return nothing();
      },
      getOrElse: function (defaultValue) {
        return defaultValue;
      },
      match: function (cases) {
        return cases.nothing();
      }
    };
  }

  function fmap(maybe, fn) {
    return maybe.map(fn);
  }

  function mbind(maybe, fn) {
    return maybe.chain(fn);
  }

  function orElse(maybe, defaultValue) {
    return maybe.getOrElse(defaultValue);
  }

  function match(maybe, onJust, onNothing) {
    return maybe.match({
      just: onJust,
      nothing: onNothing
    });
  }

  function isJust(maybe) {
    return maybe._tag === 'Just';
  }

  function isNothing(maybe) {
    return maybe._tag === 'Nothing';
  }

  function fromNullable(value) {
    return value != null ? just(value) : nothing();
  }

  function requireJust(maybe, errorMessage) {
    return maybe.match({
      just: function (value) {
        return value;
      },
      nothing: function () {
        throw new Error(errorMessage);
      }
    });
  }

  function left(error) {
    return {
      _tag: 'Left',
      map: function () {
        return left(error);
      },
      chain: function () {
        return left(error);
      },
      getOrElse: function (defaultValue) {
        return defaultValue;
      },
      match: function (cases) {
        return cases.left(error);
      }
    };
  }

  function right(value) {
    return {
      _tag: 'Right',
      map: function (fn) {
        return right(fn(value));
      },
      chain: function (fn) {
        return fn(value);
      },
      getOrElse: function () {
        return value;
      },
      match: function (cases) {
        return cases.right(value);
      }
    };
  }

  function efmap(either, fn) {
    return either.map(fn);
  }

  function ebind(either, fn) {
    return either.chain(fn);
  }

  function ematch(either, onLeft, onRight) {
    return either.match({
      left: onLeft,
      right: onRight
    });
  }

  function isLeft(either) {
    return either._tag === 'Left';
  }

  function isRight(either) {
    return either._tag === 'Right';
  }

  function compose() {
    const fns = Array.prototype.slice.call(arguments);
    return function () {
      const args = Array.prototype.slice.call(arguments);
      const last = fns[fns.length - 1];
      const rest = fns.slice(0, -1);
      return rest.reduceRight(function (acc, fn) {
        return fn(acc);
      }, last.apply(null, args));
    };
  }

  function curry(fn) {
    const arity = fn.length;

    function curried() {
      const args = Array.prototype.slice.call(arguments);
      return args.length >= arity
        ? fn.apply(null, args)
        : function () {
            return curried.apply(null, args.concat(Array.prototype.slice.call(arguments)));
          };
    }

    return curried;
  }

  function createDispatcher(entries) {
    const table = new Map(entries);
    return {
      dispatch: function (key) {
        const args = Array.prototype.slice.call(arguments, 1);
        const handler = table.get(key);
        return handler ? just(handler.apply(null, args)) : nothing();
      },
      has: function (key) {
        return table.has(key);
      },
      keys: function () {
        return Array.from(table.keys());
      }
    };
  }

  const _ = Symbol.for('forbocai_wildcard');

  function testCase(value, predicate, handler) {
    return predicate === _
      ? just(handler(value))
      : typeof predicate === 'function'
        ? predicate(value) ? just(handler(value)) : nothing()
        : predicate === value ? just(handler(value)) : nothing();
  }

  function multiMatch(value, cases) {
    return cases.length === 0
      ? nothing()
      : testCase(value, cases[0][0], cases[0][1]).match({
          just: function (nextValue) {
            return just(nextValue);
          },
          nothing: function () {
            return multiMatch(value, cases.slice(1));
          }
        });
  }

  global.functionalCore = {
    just: just,
    nothing: nothing,
    fmap: fmap,
    mbind: mbind,
    orElse: orElse,
    match: match,
    isJust: isJust,
    isNothing: isNothing,
    fromNullable: fromNullable,
    requireJust: requireJust,
    left: left,
    right: right,
    efmap: efmap,
    ebind: ebind,
    ematch: ematch,
    isLeft: isLeft,
    isRight: isRight,
    compose: compose,
    curry: curry,
    createDispatcher: createDispatcher,
    multiMatch: multiMatch,
    _: _
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
