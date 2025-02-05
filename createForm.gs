function createFormInFolder(sheetId) {
  try {
    // Get configuration from project settings
    const config = getConfig();
    
    // Get target folder
    const targetFolder = DriveApp.getFolderById(config.TARGET_FOLDER_ID);
    
    // Get the source document name
    const sourceDoc = DocumentApp.openById(config.QUESTIONS_DOC_ID);
    const sourceName = sourceDoc.getName();
    const timestamp = getTimestampSuffix();
    const formTitle = `${sourceName} - Form (${timestamp})`;
    
    // Create form directly in target folder
    const form = FormApp.create(formTitle);
    const formId = form.getId();
    const formFile = DriveApp.getFileById(formId);
    
    // Move to target folder and remove from root
    targetFolder.addFile(formFile);
    DriveApp.getRootFolder().removeFile(formFile);
    Logger.log(`Created form in target folder: ${formId} with name: ${formTitle}`);

    // Add questions to form using stored questionsData
    if (questionsData && questionsData.length > 0) {
      questionsData.forEach(question => {
        if (question.trim()) {
          form.addParagraphTextItem().setTitle(question).setRequired(true);
        }
      });
    }

    // Set form destination
    form.setDestination(FormApp.DestinationType.SPREADSHEET, sheetId);
    Logger.log(`Form linked to spreadsheet: ${sheetId}`);

    return formId;
  } catch (error) {
    Logger.log(`Error in createFormInFolder: ${error.message}`);
    throw error;
  }
}