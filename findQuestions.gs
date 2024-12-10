// Validate interview questions using Gemini API
function validateInterviewQuestions(questions, aspects) {
  try {
    // Get API key from project properties
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('Gemini API key not found in script properties');
    }

    // Check for required fields first
    const requiredFields = ['Name', 'Mobile', 'Email'];
    const hasRequiredFields = requiredFields.every(field => 
      questions.some(q => q.toLowerCase().includes(field.toLowerCase()))
    );

    if (!hasRequiredFields) {
      return {
        isValid: false,
        message: 'Missing required fields (Name, Mobile, Email)'
      };
    }

    // Skip Gemini validation for the basic info fields
    const interviewQuestions = questions.filter(q => 
      !requiredFields.some(field => q.toLowerCase().includes(field.toLowerCase()))
    );

    // Prepare aspects string
    const aspectsList = aspects.split(',').map(a => a.trim()).join(', ');

    // Prepare prompt for Gemini
    const prompt = `As a recruitment expert, evaluate if ALL these interview questions are suitable for assessing: ${aspectsList}.

Respond only with this exact JSON:
{
  "isValid": true/false
}

Where true means ALL questions are suitable for assessing the given aspects, and false means at least one question is not suitable.

Interview questions to evaluate:
${interviewQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;

    // Call Gemini API
    const response = callGeminiAPI(prompt, apiKey);
    
    // Parse JSON response
    const result = JSON.parse(response);
    
    return {
      isValid: result.isValid,
      message: result.isValid ? 
        'Questions validated successfully' : 
        'Questions do not match the specified aspects'
    };

  } catch (error) {
    Logger.log(`Error in validateInterviewQuestions: ${error.message}`);
    return {
      isValid: false,
      message: `Validation error: ${error.message}`
    };
  }
}

// Modified findQuestions function to include aspect-based validation
function findQuestions() {
  try {
    const config = getConfig();
    const questionsDoc = DocumentApp.openById(config.QUESTIONS_DOC_ID);
    const questions = questionsDoc.getBody().getText().split('\n')
                     .filter(q => q.trim())
                     .map(q => q.trim());
    
    if (questions.length === 0) {
      throw new Error('No questions found in document');
    }

    // Get aspects from script properties (set during form creation)
    const aspects = PropertiesService.getScriptProperties().getProperty('CURRENT_ASPECTS');
    if (!aspects) {
      throw new Error('Assessment aspects not found');
    }

    // Validate questions with aspects
    const validationResult = validateInterviewQuestions(questions, aspects);
    
    if (!validationResult.isValid) {
      Logger.log('Questions validation failed:', validationResult);
      throw new Error(`Question validation failed: ${validationResult.message}`);
    }

    Logger.log(`Successfully processed ${questions.length} questions`);
    return questions;
  } catch (error) {
    Logger.log(`Error finding questions: ${error.message}`);
    throw error;
  }
}