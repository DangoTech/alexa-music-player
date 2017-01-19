'use strict';

module.exports = function (type, token) {
  return {
    request : {
      type : type
    },
    context : {
      AudioPlayer : token ? { token : token } : {}
    }
  };
};