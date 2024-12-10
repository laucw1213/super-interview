// === createSheet.gs ===
function createSheetInFolder() {
  try {
    // Get configuration from project settings
    const config = getConfig();
    
    // Get target folder
    const targetFolder = DriveApp.getFolderById(config.TARGET_FOLDER_ID);
    
    // Get the source document name
    const sourceDoc = DocumentApp.openById(config.QUESTIONS_DOC_ID);
    const sourceName = sourceDoc.getName();
    const timestamp = getTimestampSuffix();
    const sheetTitle = `${sourceName} - Responses (${timestamp})`;
    
    // Create copy of template in target folder directly
    const templateFile = DriveApp.getFileById(config.TEMPLATE_SHEET_ID);
    const clonedFile = templateFile.makeCopy(sheetTitle, targetFolder);
    const clonedSheetId = clonedFile.getId();
    
    // Open the cloned spreadsheet
    const spreadsheet = SpreadsheetApp.openById(clonedSheetId);
    
    // Check if Form Questions sheet exists, if not create it
    let sheet = spreadsheet.getSheetByName(config.QUESTIONS_SHEET_NAME);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(config.QUESTIONS_SHEET_NAME);
      Logger.log(`Created new sheet: ${config.QUESTIONS_SHEET_NAME}`);
    }

    // Clear any existing content
    sheet.clear();
    
    // Write questions to the sheet using stored questionsData
    if (questionsData && questionsData.length > 0) {
      sheet.getRange(1, 1, 1, questionsData.length).setValues([questionsData]);
      Logger.log(`Added ${questionsData.length} questions to the sheet`);
    }

    return clonedSheetId;
  } catch (error) {
    Logger.log(`Error in createSheetInFolder: ${error.message}`);
    throw error;
  }
}

function createAspectSheet(sheetId, aspectsStr) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    let aspectSheet;
    
    // Try to get existing Aspects sheet or create new one
    try {
      aspectSheet = spreadsheet.getSheetByName('Aspects');
      if (aspectSheet) {
        aspectSheet.clear();
      } else {
        aspectSheet = spreadsheet.insertSheet('Aspects');
      }
    } catch (e) {
      aspectSheet = spreadsheet.insertSheet('Aspects');
    }
    
    // Process aspects string into array
    const aspects = aspectsStr.split(',')
      .map(aspect => aspect.trim())
      .filter(aspect => aspect.length > 0);
    
    if (aspects.length === 0) {
      throw new Error('No valid aspects provided');
    }
    
    // Set headers
    aspectSheet.getRange(1, 1, 1, aspects.length).setValues([aspects]);
    
    Logger.log(`Created aspect sheet with ${aspects.length} aspects: ${aspects.join(', ')}`);
    return aspectSheet.getSheetId();
    
  } catch (error) {
    Logger.log(`Error in createAspectSheet: ${error.message}`);
    throw error;
  }
}