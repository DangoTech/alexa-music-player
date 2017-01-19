'use strict';

module.exports = function (type, playBehavior, token, url, offsetInMilliseconds, shouldEndSession) {
  return {
    version: '1.0',
    response: {
      directives: [{
        type: type,
        playBehavior: playBehavior,
        audioItem: {
          stream: {
            token: token,
            url: url,
            offsetInMilliseconds: offsetInMilliseconds
          }
        }
      }],
      shouldEndSession: shouldEndSession
    }
  };
};