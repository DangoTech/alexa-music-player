'use strict';
var firebase = require('firebase');
var fs = require('fs');

var Playlist = require('./playlist');
var AlexaService = require('./alexa-service');

let ALEXA_CONFIG = require('../config/alexa-config.json');
let ALEXA_SKILL_NAME = ALEXA_CONFIG.NAME;

let FIREBASE_CONFIG = require('../config/firebase-config.json');
let FIREBASE_CONFIG_CONFIG = FIREBASE_CONFIG.CONFIG;

const DEFAULT_PLAYLIST_ID = 'tangled';

exports.handler = function (event, context, callback) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG_CONFIG);
  } catch (e) {}

  try {
    processRequest(event, context, callback);
  } catch (e) {
    context.fail(`!! ERROR !! Exception: ${e}`);
  }
};

function processRequest(event, context, callback) {
  switch (event.request.type) {
    case 'LaunchRequest':
      onLaunchRequest(event, context, callback);
      break;
    case 'IntentRequest':
      onIntentRequest(event, context, callback);
      break;
    case 'SessionEndedRequest':
      // cannot return a response
      context.succeed();
      break;

    case 'AudioPlayer.PlaybackStarted':
      // can return STOP or CLEAR_QUEUE directives or empty response
      // cannot return speech/card/reprompt
      AlexaService.respondWithEndSession(context);
      break;
    case 'AudioPlayer.PlaybackNearlyFinished':
      // can return any AudioPlayer directive
      // cannot return speech/card/reprompt
      onPlaybackNearlyFinishedRequest(event, context, callback);
      break;
    case 'AudioPlayer.PlaybackFinished':
      // can return STOP or CLEAR_QUEUE directives or empty response
      // cannot return speech/card/reprompt
      AlexaService.respondWithEndSession(context);
      break;
    case 'AudioPlayer.PlaybackStopped':
      // cannot return a response
      AlexaService.respondWithEndSession(context);
      break;
    case 'AudioPlayer.PlaybackFailed':
      // can return any AudioPlayer directive
      // cannot return speech/card/reprompt
      AlexaService.respondWithEndSession(context);
      break;

    case 'PlaybackController.PlayCommandIssued':
      onPlay(event, context, callback);
      break;
    case 'PlaybackController.PauseCommandIssued':
      onStop(event, context, callback);
      break;
    case 'PlaybackController.NextCommandIssued':
      onNext(event, context, callback);
      break;
    case 'PlaybackController.PreviousCommandIssued':
      onPrevious(event, context, callback);
      break;

    case 'System.ExceptionEncountered':
      // cannot return a response
      AlexaService.respondWithEndSession(context);
      break;

    default:
      AlexaService.respondWithEndSession(context);
  }
}

function getAudioPlayerToken(event) {
  let token = null;

  try {
    if (event
      && event.context
      && event.context.AudioPlayer
      && event.context.AudioPlayer.token) {
      token = JSON.parse(event.context.AudioPlayer.token);
    }
  } catch (e) {}

  return token;
}

function getAudioPlayerOffset(event) {
  let offsetInMilliseconds = null;

  try {
    if (event
      && event.context
      && event.context.AudioPlayer) {
      offsetInMilliseconds = event.context.AudioPlayer.offsetInMilliseconds;
    }
  } catch (e) {}

  return offsetInMilliseconds;
}

function onLaunchRequest(event, context, callback) {
  context.callbackWaitsForEmptyEventLoop = false;
  onPlay(event, context, callback);
}

function onIntentRequest(event, context, callback) {
  switch(event.request.intent.name) {
    case 'AMAZON.ResumeIntent':
      onPlay(event, context, callback);
      break;
    case 'AMAZON.CancelIntent':
    case 'AMAZON.PauseIntent':
    case 'AMAZON.StopIntent':
      onStop(event, context, callback);
      break;
    case 'AMAZON.NextIntent':
      onNext(event, context, callback);
      break;
    case 'AMAZON.PreviousIntent':
      onPrevious(event, context, callback);
      break;
    case 'AMAZON.HelpIntent':
    case 'AMAZON.LoopOffIntent':
    case 'AMAZON.LoopOnIntent':
    case 'AMAZON.NoIntent':
    case 'AMAZON.RepeatIntent':
    case 'AMAZON.ShuffleOffIntent':
    case 'AMAZON.ShuffleOnIntent':
    case 'AMAZON.StartOverIntent':
    case 'AMAZON.YesIntent':
      onUnknownIntent(event, context, callback);      
      break;
    case 'PlayPlaylist':
      onPlayPlaylist(event, context, callback);
      break;
    default:
      onUnknownIntent(event, context, callback);
  }
}

function onPlay(event, context, callback) {
  let playlist;
  let token = getAudioPlayerToken(event);
  if (token) {
    playlist = new Playlist(token.playlistId, token.currentIndex, getAudioPlayerOffset(event));
  }
  else {
    playlist = new Playlist(DEFAULT_PLAYLIST_ID, -1, 0);
  }

  playlist.resumePlay(event, context);
}

function onPlayPlaylist(event, context, callback) {
  let playlistNameSlotValue = event.request.intent.slots.PlaylistName.value;

    if (playlistNameSlotValue) {
      
      let firebase = require('firebase');
      let FIREBASE_CONFIG = require('../config/firebase-config.json');
      let FIREBASE_USERNAME = FIREBASE_CONFIG.USER.USERNAME;
      let FIREBASE_PASSWORD = FIREBASE_CONFIG.USER.PASSWORD;
      try {
        firebase.initializeApp(FIREBASE_CONFIG.CONFIG);
      }
      catch (e) {}

      // log-in to firebase
      firebase.auth().signInWithEmailAndPassword(FIREBASE_USERNAME, FIREBASE_PASSWORD)
        // fetch songs in playlist
        .then(() => firebase.database().ref(`playlists`).once('value'))
        // fetch all playlists
        .then(playlistsDS => {
          let matchingPlaylistId = null;
          
          // iterate through list of playlists and find one that matches the playlist name slot value
          playlistsDS.forEach(playlistDS => {
            console.log(JSON.stringify(playlistDS.val()));
            if (matchingPlaylistId === null) {
              let displayName = playlistDS.val().displayName;
              displayName = displayName.replace(/[^0-9a-z ]/gi, '') // remove non-alphanumeric characters
                .replace(/ +/g, " ") // convert all multispaces to single space
                .replace(/^ /g, "")  // remove spaces from the start
                .replace(/ $/g, ""); // remove spaces from the end
              playlistNameSlotValue = playlistNameSlotValue.replace(/[^0-9a-z ]/gi, '') // remove non-alphanumeric characters
                .replace(/ +/g, " ") // convert all multispaces to single space
                .replace(/^ /g, "")  // remove spaces from the start
                .replace(/ $/g, ""); // remove spaces from the end

              let regex = new RegExp(`\\b${playlistNameSlotValue}\\b`, 'gi');
              if (displayName.match(regex)) {
                matchingPlaylistId = playlistDS.key;
              }
            }
          });

          // if matching playlist found, play the playlist, else end the session
          if (matchingPlaylistId != null) {
            let playlist = new Playlist(matchingPlaylistId, -1, 0);
            playlist.playFirst(event, context);
          }
          else {
            AlexaService.respondWithEndSession(context);
          }
        });     
    }
    else {
      AlexaService.respondWithEndSession(context);
    }
}

function onStop(event, context, callback) {
  let token = getAudioPlayerToken(event);
  if (token){
    let playlist = new Playlist(token.playlistId, token.currentIndex, getAudioPlayerOffset(event));
    AlexaService.respond(
      /*context:*/ context,
      /*spokenMessage:*/ null,
      /*cardMessage:*/ null,
      /*audioUrl:*/ null,
      /*playBehavior:*/ null,
      /*token:*/ playlist.getTokenJson(),
      /*offsetInMilliseconds*/ getAudioPlayerOffset(event),
      /*expectedPreviousToken:*/ null,
      /*shouldEndSession:*/ true,
      /*isStop:*/ true,
      /*isClearQueue:*/ false);
  }
  else {
    AlexaService.respondWithEndSession(event, context, callback);
  }
}

function onNext(event, context, callback) {
  let token = getAudioPlayerToken(event);
  if (token){
    let playlist = new Playlist(token.playlistId, token.currentIndex, getAudioPlayerOffset(event));
    playlist.playNext(event, context);
  }
  else {
    AlexaService.respondWithEndSession(event, context, callback);
  }
}

function onPrevious(event, context, callback) {
  let token = getAudioPlayerToken(event);
  if (token){
    let playlist = new Playlist(token.playlistId, token.currentIndex, getAudioPlayerOffset(event));
    playlist.playPrevious(event, context);
  }
  else {
    AlexaService.respondWithEndSession(event, context, callback);
  }
}

function onPlaybackNearlyFinishedRequest(event, context, callback) {
  context.callbackWaitsForEmptyEventLoop = false;
  let playlist;
  let token = getAudioPlayerToken(event);
  if (token){
    playlist = new Playlist(token.playlistId, token.currentIndex, getAudioPlayerOffset(event));
    playlist.queueNext(event, context);
  }
  else {
    AlexaService.respondWithEndSession(context);
  }
}

function onUnknownIntent(event, context, callback) {
  AlexaService.respond(
    /*context:*/ context,
    /*spokenMessage:*/ `${ALEXA_SKILL_NAME} didn't expect to get an IntentRequest with name ${event.request.intent.name}.`,
    /*cardMessage:*/ null,
    /*audioUrl:*/ null,
    /*playBehavior:*/ null,
    /*token:*/ null,
    /*expectedPreviousToken:*/ null,
    /*shouldEndSession:*/ true,
    /*isStop:*/ false,
    /*isClearQueue:*/ false);
}
