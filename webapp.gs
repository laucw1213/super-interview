function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Google Doc Form Generator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function processGoogleDoc(docId) {
  try {
    // Update CONFIG with the new document ID
    CONFIG.QUESTIONS_DOC_ID = docId;
    
    // Run the main process
    const result = main();
    
    // Get the sheet URL
    const sheetUrl = DriveApp.getFileById(result.sheetId).getUrl();
    
    return {
      sheetUrl: sheetUrl,
      prefilledUrl: result.prefilledUrl
    };
    
  } catch (error) {
    Logger.log('Process error: ' + error.toString());
    return {
      error: error.message || 'Processing failed'
    };
  }
}