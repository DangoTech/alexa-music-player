'use strict';
var firebase = require('firebase');
var fs = require('fs');

//var Playlist = require('./playlist');
class Playlist {

    constructor(playlistId, currentIndex) {
        this.playlistId = playlistId;
        this.currentIndex = currentIndex;
    }
    
    playFirst(event, context) {
        this.currentIndex = 0;
        this.buildAudioPlayerResponse(event, context, 0, true);
    }
    
    playPrevious(event, context) {
        this.buildAudioPlayerResponse(event, context, -1, true);
    }
    
    playNext(event, context) {
        this.buildAudioPlayerResponse(event, context, 1, true);
    }

    queuePrevious(event, context) {
        this.buildAudioPlayerResponse(event, context, -1, false);
    }
    
    queueNext(event, context) {
        this.buildAudioPlayerResponse(event, context, 1, false);
    }
    
    buildAudioPlayerResponse(event, context, indexOffset, isPlayImmediately) {
        console.log("queue");
        this.getSongDownloadUrls()
            .then((urls) => {
                if (urls[this.currentIndex + indexOffset]) {
                    this.currentIndex += indexOffset;
                    respond(
                        /*context:*/ context,
                        /*spokenMessage:*/ null,
                        /*cardMessage:*/ null,
                        /*audioUrl:*/ urls[this.currentIndex],
                        /*playBehavior:*/ isPlayImmediately ? "REPLACE_ALL"  : "ENQUEUE",
                        /*token:*/ this.getTokenJson(),
                        /*expectedPreviousToken:*/ event.context.AudioPlayer.token,
                        /*shouldEndSession:*/ true,
                        /*isStop:*/ false,
                        /*isClearQueue:*/ false);
                } else {
                    respond(
                        /*context:*/ context,
                        /*spokenMessage:*/ null,
                        /*cardMessage:*/ null,
                        /*audioUrl:*/ null,
                        /*playBehavior:*/ null,
                        /*token:*/ this.getTokenJson(),
                        /*expectedPreviousToken:*/ null,
                        /*shouldEndSession:*/ true,
                        /*isStop:*/ false,
                        /*isClearQueue:*/ false);
                }
            });
    }
    
    getSongDownloadUrls() {
        let songIds;
        let downloadUrls;
        // log-in to firebase
        return firebase.auth().signInWithEmailAndPassword(FIREBASE_USERNAME, FIREBASE_PASSWORD)
            // fetch songs in playlist
            .then(() => firebase.database().ref(`playlists/${this.playlistId}/songs`).once('value'))
            // extract songIds from songs in playlist
            // fetch all songs
            .then(snapshot => {
                var playlistSongs = snapshot.val();
                songIds = Object.keys(playlistSongs).map(playlistSongKey => playlistSongs[playlistSongKey].songId); 
                return firebase.database().ref('songs').once('value');
            // use songIds to extract downloadUrls from songs
            }).then(snapshot => {
                var songs = snapshot.val();
                downloadUrls = songIds.map(songId => songs[songId].downloadUrl);
                return firebase.auth().signOut();
            }).then(() => downloadUrls);
    }
    
    getTokenJson() {
        return JSON.stringify({
            playlistId: this.playlistId,
            currentIndex: this.currentIndex
        });
    }
}

let APP_INFO = require('./AppInfo');
let APP_ID = APP_INFO.APP.ID;
let APP_TEST_ID = APP_INFO.APP.TEST_ID;
let APP_NAME = APP_INFO.APP.NAME;
let FIREBASE_USERNAME = APP_INFO.FIREBASE.USERNAME;
let FIREBASE_PASSWORD = APP_INFO.FIREBASE.PASSWORD;
let FIREBASE_CONFIG = APP_INFO.FIREBASE.CONFIG;

const DEFAULT_PLAYLIST_ID = "tangled";
    
exports.handler = function (event, context, callback) {
    if (event
        && event.request
        && event.request.type) {
            console.log(`>> EVENT.REQUEST.TYPE: ${event.request.type}`);
            console.log(`>> EVENT: ${JSON.stringify(event)}`);
        }

    if (event.session
        && event.session.application
        && event.session.application.applicationId !== APP_ID
        && event.session.application.applicationId !== APP_TEST_ID) {
        context.fail("ERROR: Invalid Application ID");
    }
    else {
        try {
            firebase.initializeApp(FIREBASE_CONFIG);
        } catch (e) {}

        try {
            processRequest(event, context, callback);
        } catch (e) {
            context.fail(`!! ERROR !! Exception: ${e}`);
        }
    }
};

function processRequest(event, context, callback) {
    switch (event.request.type) {
        case "LaunchRequest":
            onLaunchRequest(event, context, callback);
            break;
        case "IntentRequest":
            onIntentRequest(event, context, callback);
            break;
        case "SessionEndedRequest":
            // cannot return a response
            context.succeed();
            break;

        case "AudioPlayer.PlaybackStarted":
            // can return STOP or CLEAR_QUEUE directives or empty response
            // cannot return speech/card/reprompt
            respondWithEndSession(context);
            break;
        case "AudioPlayer.PlaybackNearlyFinished":
            // can return any AudioPlayer directive
            // cannot return speech/card/reprompt
            onPlaybackNearlyFinishedRequest(event, context, callback);
            break;
        case "AudioPlayer.PlaybackFinished":
            // can return STOP or CLEAR_QUEUE directives or empty response
            // cannot return speech/card/reprompt
            respondWithEndSession(context);
            break;
        case "AudioPlayer.PlaybackStopped":
            // cannot return a response
            respondWithEndSession(context);
            break;
        case "AudioPlayer.PlaybackFailed":
            // can return any AudioPlayer directive
            // cannot return speech/card/reprompt
            respondWithEndSession(context);
            break;

        case "System.ExceptionEncountered":
            // cannot return a response
            respondWithEndSession(context);
            break;

        default:
            respondWithEndSession(context);
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

function onLaunchRequest(event, context, callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    let playlist;
    let token = getAudioPlayerToken(event);
    if (token) {
        playlist = new Playlist(token.playlistId, token.currentIndex);
    }
    else {
        playlist = new Playlist(DEFAULT_PLAYLIST_ID, -1);
    }

    playlist.playFirst(event, context);
}

function onIntentRequest(event, context, callback) {
    let token = getAudioPlayerToken(event);
    switch(event.request.intent.name) {
        case "AMAZON.CancelIntent":
        case "AMAZON.PauseIntent":
        case "AMAZON.StopIntent":
            if (token){
                let playlist = new Playlist(token.playlistId, token.currentIndex);
                respond(
                    /*context:*/ context,
                    /*spokenMessage:*/ null,
                    /*cardMessage:*/ null,
                    /*audioUrl:*/ null,
                    /*playBehavior:*/ null,
                    /*token:*/ playlist.getTokenJson(),
                    /*expectedPreviousToken:*/ null,
                    /*shouldEndSession:*/ true,
                    /*isStop:*/ true,
                    /*isClearQueue:*/ false);
            }
            else {
                respondWithEndSession(event, context, callback);
            }
            break;
        case "AMAZON.NextIntent":
            if (token){
                let playlist = new Playlist(token.playlistId, token.currentIndex);
                playlist.playNext(event, context);
            }
            else {
                respondWithEndSession(event, context, callback);
            }
            break;
        case "AMAZON.PreviousIntent":
            if (token){
                let playlist = new Playlist(token.playlistId, token.currentIndex);
                playlist.playPrevious(event, context);
            }
            else {
                respondWithEndSession(event, context, callback);
            }
            break;
        case "AMAZON.HelpIntent":
        case "AMAZON.LoopOffIntent":
        case "AMAZON.LoopOnIntent":
        case "AMAZON.NoIntent":
        case "AMAZON.RepeatIntent":
        case "AMAZON.ResumeIntent":
        case "AMAZON.ShuffleOffIntent":
        case "AMAZON.ShuffleOnIntent":
        case "AMAZON.StartOverIntent":
        case "AMAZON.YesIntent":
            respond(
                /*context:*/ context,
                /*spokenMessage:*/ `${APP_NAME} didn't expect to get an IntentRequest with name ${event.request.intent.name}.`,
                /*cardMessage:*/ null,
                /*audioUrl:*/ null,
                /*playBehavior:*/ null,
                /*token:*/ null,
                /*expectedPreviousToken:*/ null,
                /*shouldEndSession:*/ true,
                /*isStop:*/ false,
                /*isClearQueue:*/ false);
            break;
        case "PlayPlaylist":
            let playlistId = event.request.intent.slots.PlaylistId.value;
            if (playlistId) {
                let playlist = new Playlist(playlistId, -1);
                console.log(playlist);
                playlist.playFirst(event, context);
            }
            else {
                respondWithEndSession(event, context, callback);
            }
            break;
        default:
            respond(
                /*context:*/ context,
                /*spokenMessage:*/ `${APP_NAME} didn't expect to get an IntentRequest with name ${event.request.intent.name}.`,
                /*cardMessage:*/ null,
                /*audioUrl:*/ null,
                /*playBehavior:*/ null,
                /*token:*/ null,
                /*expectedPreviousToken:*/ null,
                /*shouldEndSession:*/ true,
                /*isStop:*/ false,
                /*isClearQueue:*/ false);
    }
}

function onPlaybackNearlyFinishedRequest(event, context, callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    let playlist;
    let token = getAudioPlayerToken(event);
    if (token){
        playlist = new Playlist(token.playlistId, token.currentIndex);
        playlist.queueNext(event, context);
    }
    else {
        respondWithEndSession(context);
    }
}

function respondWithEndSession(context) {
    respond(
        /*context:*/ context,
        /*spokenMessage:*/ null,
        /*cardMessage:*/ null,
        /*audioUrl:*/ null,
        /*playBehavior:*/ null,
        /*token:*/ null,
        /*expectedPreviousToken:*/ null,
        /*shouldEndSession:*/ true,
        /*isStop:*/ false,
        /*isClearQueue:*/ false);
}

function respond(
    context, 
    spokenMessage, 
    cardMessage, 
    audioUrl, 
    playBehavior,
    token,
    expectedPreviousToken,
    shouldEndSession,
    isStop,
    isClearQueue) {
    
    context.succeed(
        buildResponseJSON(
            spokenMessage,
            cardMessage,
            audioUrl,
            playBehavior,
            token,
            expectedPreviousToken,
            shouldEndSession,
            isStop,
            isClearQueue));
}

function buildResponseJSON(
    spokenMessage, 
    cardMessage, 
    audioUrl,
    playBehavior,
    token,
    expectedPreviousToken,
    shouldEndSession,
    isStop,
    isClearQueue) {
    
    var responseBody = {
        version: "1.0",
        // sessionAttributes: {}
        response: {}
    };
    
    if (spokenMessage) {
        responseBody.response.outputSpeech = 
            {
                type: "PlainText",
                text: spokenMessage,
            };
    }
    
    if (cardMessage) {
        responseBody.response.card = 
            {
                type: "Simple",
                title: APP_NAME,
                content: cardMessage,
            };
    }
    
    if (audioUrl) {
        responseBody.response.directives = [
            {
                type: "AudioPlayer.Play", 
                playBehavior: playBehavior || "REPLACE_ALL",
                audioItem: {
                    stream: {
                        token: token,
                        url: audioUrl,
                        offsetInMilliseconds: 0
                    }
                }
            }
        ];
        
        if (responseBody.response.directives[0].playBehavior === "ENQUEUE") {
            responseBody.response.directives[0].audioItem.stream.expectedPreviousToken = expectedPreviousToken;
        }
    }
    
    if (isStop) {
        responseBody.response.directives = [
            {
                type: "AudioPlayer.Stop"
            }
        ];
    }
    
    if (isClearQueue) {
        responseBody.response.directives = [
            {
                type: "AudioPlayer.ClearQueue", 
                clearBehavior: "CLEAR_ENQUEUED"
            }
        ];
    }
    
    responseBody.response.shouldEndSession = !!shouldEndSession;
    
    console.log(`>> RESPONSE BODY: ${JSON.stringify(responseBody)}`);
    
    return responseBody;
}