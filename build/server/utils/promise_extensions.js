// Generated by CoffeeScript 1.7.1
var Promise;

Promise = require('bluebird');

Promise.prototype.serie = function(fn) {
  return this.map(fn, {
    concurrency: 1
  });
};

Promise.serie = function(array, fn) {
  return Promise.map(array, fn, {
    concurrency: 1
  });
};

Promise.prototype.throwIfNull = function(errorMaker) {
  return this.then(function(result) {
    if (result != null) {
      return result;
    } else {
      throw errorMaker();
    }
  });
};
