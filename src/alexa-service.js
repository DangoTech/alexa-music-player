'use strict';
let ALEXA_CONFIG = require('../config/alexa-config.json');
let ALEXA_SKILL_NAME = ALEXA_CONFIG.NAME;

module.exports = class AlexaService {
  static respondWithEndSession(context) {
    this.respond(
      /*context:*/ context,
      /*spokenMessage:*/ null,
      /*cardMessage:*/ null,
      /*audioUrl:*/ null,
      /*playBehavior:*/ null,
      /*token:*/ null,
      /*offsetInMilliseconds*/ null,
      /*expectedPreviousToken:*/ null,
      /*shouldEndSession:*/ true,
      /*isStop:*/ false,
      /*isClearQueue:*/ false);
  }

  static respond(
    context,
    spokenMessage,
    cardMessage,
    audioUrl,
    playBehavior,
    token,
    offsetInMilliseconds,
    expectedPreviousToken,
    shouldEndSession,
    isStop,
    isClearQueue) {

    context.succeed(
      this.buildResponseJSON(
        spokenMessage,
        cardMessage,
        audioUrl,
        playBehavior,
        token,
        offsetInMilliseconds,
        expectedPreviousToken,
        shouldEndSession,
        isStop,
        isClearQueue));
  }

  static buildResponseJSON(
    spokenMessage,
    cardMessage,
    audioUrl,
    playBehavior,
    token,
    offsetInMilliseconds,
    expectedPreviousToken,
    shouldEndSession,
    isStop,
    isClearQueue) {

    var responseBody = {
      version: '1.0',
      // sessionAttributes: {}
      response: {}
    };

    if (spokenMessage) {
      responseBody.response.outputSpeech =
        {
          type: 'PlainText',
          text: spokenMessage,
        };
    }

    if (cardMessage) {
      responseBody.response.card =
        {
          type: 'Simple',
          title: ALEXA_SKILL_NAME,
          content: cardMessage,
        };
    }

    if (audioUrl) {
      responseBody.response.directives = [
        {
          type: 'AudioPlayer.Play',
          playBehavior: playBehavior || 'REPLACE_ALL',
          audioItem: {
            stream: {
              token: token,
              url: audioUrl,
              offsetInMilliseconds: offsetInMilliseconds
            }
          }
        }
      ];

      if (responseBody.response.directives[0].playBehavior === 'ENQUEUE') {
        responseBody.response.directives[0].audioItem.stream.expectedPreviousToken = expectedPreviousToken;
      }
    }

    if (isStop) {
      responseBody.response.directives = [
        {
          type: 'AudioPlayer.Stop'
        }
      ];
    }

    if (isClearQueue) {
      responseBody.response.directives = [
        {
          type: 'AudioPlayer.ClearQueue',
          clearBehavior: 'CLEAR_ENQUEUED'
        }
      ];
    }

    responseBody.response.shouldEndSession = !!shouldEndSession;

    console.log(`>> RESPONSE BODY: ${JSON.stringify(responseBody)}`);

    return responseBody;
  }
};