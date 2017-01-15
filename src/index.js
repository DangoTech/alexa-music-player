"use strict";
var firebase = require("firebase");
var fs = require("fs");

var Playlist = require("./playlist");
var AlexaService = require("./alexa-service");

// location of _no_commit is off by 1 folder directory
let ALEXA_CONFIG = require("./_no_commit/alexa-config.json");
let ALEXA_SKILL_ID = ALEXA_CONFIG.ID;
let ALEXA_SKILL_TEST_ID = ALEXA_CONFIG.TEST_ID;
let ALEXA_SKILL_NAME = ALEXA_CONFIG.NAME;

// location of _no_commit is off by 1 folder directory
let FIREBASE_CONFIG = require("./_no_commit/firebase-config.json");
let FIREBASE_CONFIG_CONFIG = FIREBASE_CONFIG.CONFIG;

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
        && event.session.application.applicationId !== ALEXA_SKILL_ID
        && event.session.application.applicationId !== ALEXA_SKILL_TEST_ID) {
        context.fail("ERROR: Invalid Application ID");
    }
    else {
        try {
            firebase.initializeApp(FIREBASE_CONFIG_CONFIG);
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
            AlexaService.respondWithEndSession(context);
            break;
        case "AudioPlayer.PlaybackNearlyFinished":
            // can return any AudioPlayer directive
            // cannot return speech/card/reprompt
            onPlaybackNearlyFinishedRequest(event, context, callback);
            break;
        case "AudioPlayer.PlaybackFinished":
            // can return STOP or CLEAR_QUEUE directives or empty response
            // cannot return speech/card/reprompt
            AlexaService.respondWithEndSession(context);
            break;
        case "AudioPlayer.PlaybackStopped":
            // cannot return a response
            AlexaService.respondWithEndSession(context);
            break;
        case "AudioPlayer.PlaybackFailed":
            // can return any AudioPlayer directive
            // cannot return speech/card/reprompt
            AlexaService.respondWithEndSession(context);
            break;

        case "System.ExceptionEncountered":
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
                AlexaService.respond(
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
                AlexaService.respondWithEndSession(event, context, callback);
            }
            break;
        case "AMAZON.NextIntent":
            if (token){
                let playlist = new Playlist(token.playlistId, token.currentIndex);
                playlist.playNext(event, context);
            }
            else {
                AlexaService.respondWithEndSession(event, context, callback);
            }
            break;
        case "AMAZON.PreviousIntent":
            if (token){
                let playlist = new Playlist(token.playlistId, token.currentIndex);
                playlist.playPrevious(event, context);
            }
            else {
                AlexaService.respondWithEndSession(event, context, callback);
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
            break;
        case "PlayPlaylist":
            let playlistId = event.request.intent.slots.PlaylistId.value;
            if (playlistId) {
                let playlist = new Playlist(playlistId, -1);
                console.log(playlist);
                playlist.playFirst(event, context);
            }
            else {
                AlexaService.respondWithEndSession(event, context, callback);
            }
            break;
        default:
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
        AlexaService.respondWithEndSession(context);
    }
}
