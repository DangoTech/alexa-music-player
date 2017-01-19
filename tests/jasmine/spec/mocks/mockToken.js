'use strict';

module.exports = function (playlistId, currentIndex) {
  return JSON.stringify({
    playlistId : playlistId,
    currentIndex : currentIndex
  });
};