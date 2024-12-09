function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Google Doc Form Generator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function processGoogleDoc(docId, aspects) {
  try {
    PropertiesService.getScriptProperties().setProperty('QUESTIONS_DOC_ID', docId);
    CONFIG.QUESTIONS_DOC_ID = docId;
    
    // Create params object to pass to main
    const params = {
      aspects: aspects
    };
    
    const result = main(params);  // Pass params object to main
    
    return {
      sheetUrl: getSheetUrl(result.sheetId),
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

function getSheetUrl(sheetId) {
  try {
    const sheet = SpreadsheetApp.openById(sheetId);
    return sheet.getUrl();
  } catch (error) {
    Logger.log(`Error getting sheet URL: ${error.message}`);
    throw error;
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