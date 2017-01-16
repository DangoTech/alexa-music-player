const ALEXA_CONFIG = require('_no_commit/alexa-config.json');
const ALEXA_SKILL_ID = ALEXA_CONFIG.ID;
const ALEXA_SKILL_TEST_ID = ALEXA_CONFIG.TEST_ID;

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
    var main = require('src/main');
    main.handler(event, context, callback);
  }
};