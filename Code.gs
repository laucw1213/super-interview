function main(params) {
  try {
    // Validate configuration
    validateConfig();

    // Store aspects for validation
    if (params && params.aspects) {
      PropertiesService.getScriptProperties().setProperty('CURRENT_ASPECTS', params.aspects);
    } else {
      throw new Error('Assessment aspects not provided');
    }
    
    // Step 1: Get and validate questions
    try {
      questionsData = findQuestions();
      if (!questionsData) {
        // 如果没有问题数据，直接返回错误
        return {
          error: '无法获取问题数据',
          status: 'error'
        };
      }
    } catch (error) {
      // 捕获验证失败的错误并返回
      return {
        error: error.message,
        status: 'error'
      };
    }

    // 只有在验证通过后才继续执行后续步骤
    // Step 2: Create sheet and form
    const sheetId = createSheetInFolder();
    Logger.log(`Created sheet ID: ${sheetId}`);

    const formId = createFormInFolder(sheetId);
    Logger.log(`Created form ID: ${formId}`);

    makeFormPublic(formId);

    // Step 3: Get answers
    answersData = suggestAnswers(questionsData);
    Logger.log('\nQuestions and Answers:');
    answersData.questions.forEach((question, index) => {
      Logger.log(`\nQ${index + 1}: ${question}`);
      Logger.log(`A${index + 1}: ${answersData.answers[index]}`);
    });

    // Step 4: Create aspect sheet with provided aspects
    if (params && params.aspects) {
      createAspectSheet(sheetId, params.aspects);
    }

    // Step 5: Get form entry IDs and form URL
    const form = FormApp.openById(formId);
    const formUrl = form.getPublishedUrl();
    const entryIds = findEntryIds(formId);
    Logger.log('Found Entry IDs:');
    Logger.log(entryIds);

    // Step 6: Generate prefilled form link
    const prefilledUrl = generatePrefilledLink(formUrl, entryIds, answersData.answers);
    Logger.log('Generated prefilled form URL:');
    Logger.log(prefilledUrl);

    return {
      sheetId: sheetId,
      formId: formId,
      prefilledUrl: prefilledUrl,
      status: 'success'
    };

  } catch (error) {
    Logger.log(`Error in main function: ${error.message}`);
    return {
      error: error.message,
      status: 'error'
    };
  }
}