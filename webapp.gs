function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Google Doc Form Generator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function processGoogleDoc(docId) {
  try {
    // Update the QUESTIONS_DOC_ID in Script Properties
    PropertiesService.getScriptProperties().setProperty('QUESTIONS_DOC_ID', docId);
    
    // Update the CONFIG object
    CONFIG.QUESTIONS_DOC_ID = docId;
    
    // Continue with the rest of the process
    const result = main();
    
    return {
      sheetUrl: result.sheetUrl,
      formId: result.formId,
      prefilledUrl: result.prefilledUrl
    };
    
  } catch (error) {
    Logger.log('Process error: ' + error.toString());
    return {
      error: error.message || 'Processing failed'
    };
  }
}

function getFormEditorUrl(formId) {
  try {
    const form = FormApp.openById(formId);
    return form.getEditUrl();
  } catch (error) {
    throw new Error('Unable to generate form editor URL');
  }
}

function getPublishedFormUrl(formId) {
  try {
    const form = FormApp.openById(formId);
    return form.getPublishedUrl();
  } catch (error) {
    throw new Error('Unable to get published form URL');
  }
}