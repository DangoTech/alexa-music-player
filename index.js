'use strict';

const ALEXA_CONFIG = require('config/alexa-config.json');
const ALEXA_SKILL_ID = ALEXA_CONFIG.ID;
const ALEXA_SKILL_TEST_ID = ALEXA_CONFIG.TEST_ID;

exports.handler = function (event, context, callback) {
  if (event
    && event.request
    && event.request.type) {
      console.log(`>> EVENT.REQUEST.TYPE: ${event.request.type}`);
      console.log(`>> EVENT: ${JSON.stringify(event)}`);
  }

  let appId = event.session
      && event.session.application
      ? event.session.application.applicationId
      : null;
  if (appId !== ALEXA_SKILL_ID) {
    context.fail(`ERROR: Invalid Application ID: Expecting ${"ALEXA_SKILL_ID"} but received ${appId}`);
  }
  else {
    var main = require('src/main');
    main.handler(event, context, callback);
  }
};