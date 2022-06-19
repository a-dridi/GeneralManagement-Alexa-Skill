/* eslint-disable no-use-before-define */
/* eslint-disable global-require */

const Alexa = require('ask-sdk-core');
const util = require('./util'); // utility functions
const constants = require('./constants'); // constants such as specific service permissions go here

//CHANGE THESE **
const GM_USERNAME = "ardat@ardmail.net";
const GM_PASSWORD = "ml_201437";
const GM_USER_ID = "151";

const GM_LOGIN = "https://management.ardmail.net/api/login";
const GM_SEARCH_ORGANIZATION = "https://management.ardmail.net/api/common/data/organization/search/byDescription/151";

const api_client = GM_LOGIN.startsWith('https') ? require('https') : require('http');

const MAX_NUMBER_OF_SPOKEN_RESULTS = "4";
//CHANGE THESE - END **


var authenticationToken = "";
const runUserAuthentication = () => new Promise((resolve, reject) => {
  const loginFormContent = JSON.stringify({
    "email": GM_USERNAME,
    "password": GM_PASSWORD
  });
  const options = {
    method: "POST",
    headers: {
      'Content-Type': 'text/plain',
      'Content-Length': Buffer.byteLength(loginFormContent)
    }
  };

  const request = api_client.request(GM_LOGIN, options, (res) => {
    if (res.statusCode < 200 || res.statusCode > 299) {
      reject(new Error(`Failed with status code: ${res.statusCode}`));
    }
    res.on('data', (chunk) => {});
    res.on('end', () => {
      resolve(res.headers.authorization);
    });
  });
  request.end(loginFormContent);
  request.on('error', (err) => reject(err));
});

const SearchingDescriptionHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest' ||
      (handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
        handlerInput.requestEnvelope.request.intent.name === 'SearchingDescriptionIntent');
  },
  async handle(handlerInput) {
    let outputSpeech = "";
    let searchedDescription = "";
    var intent = handlerInput.requestEnvelope.request.intent;

    if (intent !== undefined && intent.slots !== undefined && intent.slots.searcheddescription.value !== undefined) {
      searchedDescription = intent.slots.searcheddescription.value
    }

    await runUserAuthentication()
      .then((response) => {
        authenticationToken = response;
      })
      .catch((err) => {
        console.log(`ERROR: ${err.message}`);
        // set an optional error message here
        outputSpeech = err.message;
        return;
      });

    if (searchedDescription === "") {
      outputSpeech = "Was suchen Sie?";

      // Create APL screen
      if (util.supportsAPL(handlerInput) && outputSpeech) {
        handlerInput.responseBuilder.addDirective({
          type: 'Alexa.Presentation.APL.RenderDocument',
          version: '1.1',
          document: constants.APL.welcomeDoc,
          datasources: {
            launchData: {
              type: 'object',
              properties: {
                headerTitle: "Abfrage: Organisierung - General Management",
                mainText: "Welchen Gegenstand suchen Sie? - Sagen Sie z.B.: Wo ist Kabel?",
                hintString: "Organisierung abrufen, Wo ist Kabel?",
                logoImage: 'https://WEB_SERVER/media/organisierung/skill_icon_logo_big.png',
                backgroundImage: 'https://WEB_SERVER/media/organisierung/skill_background.png',
                backgroundOpacity: "0.5"
              },
              transformers: [{
                inputPath: 'hintString',
                transformer: 'textToHint',
              }]
            }
          }
        });

        // Add home card to response
        // If you're using an Alexa Hosted Skill the images below will expire
        // and could not be shown in the card. You should replace them with static images
        handlerInput.responseBuilder.withStandardCard(
          'Abfrage: Organisierung - General Management',
          outputSpeech,
          'https://WEB_SERVER/media/organisierung/skill_background.png');
      }

    } else {
      await postRemoteData(GM_SEARCH_ORGANIZATION, searchedDescription)
        .then((response) => {
          const data = JSON.parse(response);
          const maxIterationAmount = data.length > MAX_NUMBER_OF_SPOKEN_RESULTS ? MAX_NUMBER_OF_SPOKEN_RESULTS : data.length;

          //Create output spoken speach
          outputSpeech += `Ich habe ${data.length} Stück von ${searchedDescription} gefunden. `;
          for (let i = 0; i < maxIterationAmount; i += 1) {
            if (i === 0) {
              // first record
              outputSpeech = `${outputSpeech} Der Gegenstand: ${data[i].description} ist in ${data[i].location}, `;
            } else if (i === maxIterationAmount - 1) {
              // last record
              outputSpeech = `${outputSpeech} und Gegenstand: ${data[i].description} in ${data[i].location}`;
            } else {
              // middle record(s)
              outputSpeech = `${outputSpeech} Gegenstand: ${data[i].description} in ${data[i].location}, `
            }
          }

          // Create APL screen
          if (util.supportsAPL(handlerInput) && outputSpeech) {
            handlerInput.responseBuilder.addDirective({
              type: 'Alexa.Presentation.APL.RenderDocument',
              version: '1.1',
              document: constants.APL.listDoc,
              datasources: {
                listData: {
                  type: 'object',
                  properties: {
                    config: {
                      backgroundImage: 'https://WEB_SERVER/media/organisierung/skill_background.png',
                      title: "Organisierung - General Management",
                      skillIcon: 'https://WEB_SERVER/media/organisierung/skill_icon_logo.png',
                      hintText: "Organisierung abrufen, Wo ist Kabel?"
                    },
                    list: {
                      listItems: data
                    }
                  },
                  transformers: [{
                    inputPath: 'config.hintText',
                    transformer: 'textToHint'
                  }]
                }
              }
            });

            // Add home card to response
            // If you're using an Alexa Hosted Skill the images below will expire
            // and could not be shown in the card. You should replace them with static images
            handlerInput.responseBuilder.withStandardCard(
              'Organisierung - General Management',
              outputSpeech,
              'https://WEB_SERVER/media/organisierung/skill_background.png');
          }
        })
        .catch((err) => {
          console.log(`ERROR: ${err.message}`);
          // set an optional error message here
          outputSpeech += searchedDescription + " konnte nicht gefunden werden. ";
          // Create APL screen
          if (util.supportsAPL(handlerInput) && outputSpeech) {
            handlerInput.responseBuilder.addDirective({
              type: 'Alexa.Presentation.APL.RenderDocument',
              version: '1.1',
              document: constants.APL.welcomeDoc,
              datasources: {
                launchData: {
                  type: 'object',
                  properties: {
                    headerTitle: "Abfrage: Organisierung - General Management",
                    mainText: "Gegenstand: " + searchedDescription + " nicht gefunden!",
                    hintString: "Organisierung abrufen, Wo ist Kabel?",
                    logoImage: 'https://WEB_SERVER/media/organisierung/skill_icon_logo_big.png',
                    backgroundImage: 'https://WEB_SERVER/media/organisierung/skill_background.png',
                    backgroundOpacity: "0.5"
                  },
                  transformers: [{
                    inputPath: 'hintString',
                    transformer: 'textToHint',
                  }]
                }
              }
            });

            // Add home card to response
            // If you're using an Alexa Hosted Skill the images below will expire
            // and could not be shown in the card. You should replace them with static images
            handlerInput.responseBuilder.withStandardCard(
              'Abfrage: Organisierung - General Management',
              outputSpeech,
              'https://WEB_SERVER/media/organisierung/skill_background.png');
          }

        });
    }
    return handlerInput.responseBuilder
      .speak(outputSpeech)
      .getResponse();
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speechText = 'Um ein Gegenstand nach dem Namen zu finden. Sagen Sie zum Beispiel.: Wo ist Kabel';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent' ||
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const speechText = 'Auf wiedersehen!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Sitzung mit diesem Grund beendet: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error occured: ${error.message}`);

    return handlerInput.responseBuilder
      .speak('Tut mir leid, ich konnte SIe nicht verstehen. Bitte sprechen Sie noch einmal.')
      .reprompt('Tut mir leid, ich konnte SIe nicht verstehen. Um ein Gegenstand nach dem Namen zu finden. Sagen Sie zum Beispiel.: Wo ist Kabel')
      .getResponse();
  },
};

/*
const getRemoteData = (url) => new Promise((resolve, reject) => {
  if (authenticationToken === "") {
    await authenticateUser()
      .then((response) => {
        console.log(response);
        authenticationToken = response;
      })
      .catch((err) => {
        console.log(`ERROR: ${err.message}`);
        // set an optional error message here
        // outputSpeech = err.message;
      });
  }

  const client = url.startsWith('https') ? require('https') : require('http');
  const request = client.get(url, (response) => {
    if (response.statusCode < 200 || response.statusCode > 299) {
      reject(new Error(`Failed with status code: ${response.statusCode}`));
    }
    const body = [];
    response.on('data', (chunk) => body.push(chunk));
    response.on('end', () => resolve(body.join('')));
  });
  request.on('error', (err) => reject(err));
});
*/

const postRemoteData = (url, searchedDescription) => new Promise((resolve, reject) => {
  const postOptions = {
    method: "POST",
    headers: {
      'Authorization': authenticationToken,
      'Content-Type': 'text/plain',
      'Content-Length': Buffer.byteLength(searchedDescription)
    }
  };
  const request = api_client.request(url, postOptions, (response) => {
    if (response.statusCode < 200 || response.statusCode > 299) {
      reject(new Error(`Failed with status code: ${response.statusCode}`));
    }
    const body = [];
    response.on('data', (chunk) => body.push(chunk));
    response.on('end', () => resolve(body.join('')));
  });
  request.write(searchedDescription);
  request.on('error', (err) => reject(err));
});

const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    SearchingDescriptionHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();