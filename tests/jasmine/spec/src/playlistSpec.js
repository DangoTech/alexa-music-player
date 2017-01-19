'use strict';

describe('playlistSpec.js', () => {
  let Playlist = require('../../../../src/playlist');;
  let AlexaConstants = require('../testUtils/alexa-constants');
  let mockContext = require('../mocks/mockContext');
  let mockEvent = require('../mocks/mockEvent');
  let mockResponseV1 = require('../mocks/mockResponseV1');;
  let mockToken = require('../mocks/mockToken');

  it('playlist to be defined', () => {
    let playlist = new Playlist();
    expect(playlist).toBeDefined();
    expect(playlist.playFirst).toBeDefined();
  });

  it('playlist to return a controlled list of URLs', done => {
    let playlist = new Playlist();
    let mockPlaylist = ['songUrl1', 'songUrl2', 'songUrl3'];
    spyOn(playlist, 'getSongDownloadUrls').and.returnValue(new Promise((resolve) => resolve(mockPlaylist)) );

    playlist.getSongDownloadUrls().then(urls => {
      expect(urls).toEqual(mockPlaylist);
      done();
    });
  });

  it('check response from buidAudioPlayerResponse', done => {
    let mockPlaylist = ['songUrl1', 'songUrl2', 'songUrl3'];

    let playlist = new Playlist('playlist1', 0);
    spyOn(playlist, 'getSongDownloadUrls').and.returnValue(new Promise((resolve) => resolve(mockPlaylist)) );

    let event = mockEvent(AlexaConstants.REQUEST.LAUNCH_REQUEST);
    let context = mockContext(responseJson => {
      expect(responseJson).toEqual(expectedResponse);
      done();
    }, err => {
      fail(err);
    });
    let expectedResponse = mockResponseV1(
      /* type */AlexaConstants.RESPONSE.TYPE.AUDIOPLAYER_PLAY,
      /* playBehaviour */ AlexaConstants.RESPONSE.PLAY_BEHAVIOUR.REPLACE_ALL,
      /* token */ playlist.getTokenJson(),
      /* url */ 'songUrl1',
      /* offsetInMilliseconds */ 0,
      /* shouldEndSession */ true);

    let indexOffset = 0;
    let isPlayImmediately = true;

    playlist.buildAudioPlayerResponse(event, context, indexOffset, isPlayImmediately);
  });

  it('check playFirst', done => {
    let mockPlaylist = ['songUrl1', 'songUrl2', 'songUrl3'];

    let playlist = new Playlist('playlist1', -1);
    spyOn(playlist, 'getSongDownloadUrls').and.returnValue(new Promise((resolve) => resolve(mockPlaylist)) );

    let event = mockEvent(AlexaConstants.REQUEST.LAUNCH_REQUEST);
    let context = mockContext(responseJson => {
      expect(responseJson).toEqual(expectedResponse);
      done();
    });
    let expectedToken = mockToken('playlist1', 0);
    let expectedResponse = mockResponseV1(
      /* type */AlexaConstants.RESPONSE.TYPE.AUDIOPLAYER_PLAY,
      /* playBehaviour */ AlexaConstants.RESPONSE.PLAY_BEHAVIOUR.REPLACE_ALL,
      /* token */ expectedToken,
      /* url */ 'songUrl1',
      /* offsetInMilliseconds */ 0,
      /* shouldEndSession */ true);

    playlist.playFirst(event, context);
  });

  it('check playNext, currently playing songUrl2', done => {
    let mockPlaylist = ['songUrl1', 'songUrl2', 'songUrl3'];

    let playlist = new Playlist('playlist1', 1);
    spyOn(playlist, 'getSongDownloadUrls').and.returnValue(new Promise((resolve) => resolve(mockPlaylist)) );

    let event = mockEvent(AlexaConstants.REQUEST.LAUNCH_REQUEST, playlist.getTokenJson());
    let context = mockContext(responseJson => {
      expect(responseJson).toEqual(expectedResponse);
      done();
    });
    let expectedToken = mockToken('playlist1', 2);
    let expectedResponse = mockResponseV1(
      /* type */AlexaConstants.RESPONSE.TYPE.AUDIOPLAYER_PLAY,
      /* playBehaviour */ AlexaConstants.RESPONSE.PLAY_BEHAVIOUR.REPLACE_ALL,
      /* token */ expectedToken,
      /* url */ 'songUrl3',
      /* offsetInMilliseconds */ 0,
      /* shouldEndSession */ true);

    playlist.playNext(event, context);
  });
});