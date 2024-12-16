function suggestAnswers(questions) {
  try {
    // Get API key from project properties
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('Gemini API key not found in script properties');
    }

    // Format prompt to request JSON response with realistic info
    const prompt = `Act as an expert sales professional and generate interview responses.

For a more natural response, provide your response in this exact format (do not include any code blocks or backticks):
{
  "responses": [
    "Your name (realistic)",
    "Your Hong Kong mobile number (+852 format)",
    "Your email address (matching the name)",
    "detailed answer to fourth question",
    "detailed answer to fifth question",
    "etc..."
  ]
}

Guidelines for answers after the first three:
- Demonstrate strong negotiation skills and empathy
- Include specific examples with metrics
- Keep responses professional and concise (150-200 words)
- Focus on showing skills and experience
- Do not include the question text
- Align answers with the questions asked

Here are the questions:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;

    // Call Gemini API
    const response = callGeminiAPI(prompt, apiKey);
    Logger.log('Raw API response:', response);
    
    // Handle response parsing
    let parsedResponse;
    try {
      // Clean up the response text
      let cleanedResponse = response;
      
      // If response is wrapped in code blocks, extract it
      const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
      if (codeBlockMatch) {
        cleanedResponse = codeBlockMatch[1];
      }

      // Ensure the response has proper JSON structure
      if (!cleanedResponse.trim().startsWith('{')) {
        cleanedResponse = '{' + cleanedResponse;
      }
      if (!cleanedResponse.trim().endsWith('}')) {
        cleanedResponse = cleanedResponse + '}';
      }

      Logger.log('Cleaned response:', cleanedResponse);
      parsedResponse = JSON.parse(cleanedResponse);
      
    } catch (parseError) {
      Logger.log('Parse error:', parseError);
      throw new Error(`Failed to parse API response: ${parseError.message}`);
    }

    // Extract answers from parsed response
    const answers = parsedResponse.responses || [];
    Logger.log('Parsed answers:', answers);

    // Ensure we have enough answers
    const resultAnswers = new Array(questions.length).fill('No answer generated');
    answers.forEach((answer, index) => {
      if (index < questions.length) {
        resultAnswers[index] = answer;
      }
    });

    return {
      questions: questions,
      answers: resultAnswers
    };

  } catch (error) {
    Logger.log(`Error in suggestAnswers: ${error.message}`);
    // Return more informative error messages instead of generic ones
    return {
      questions: questions,
      answers: new Array(questions.length).fill(`Error: ${error.message}`)
    };
  }
}

function callGeminiAPI(prompt, apiKey) {
  // Updated endpoint for Gemini 1.5 Pro
  const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
  
  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
      candidateCount: 1
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ]
  };

  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(apiEndpoint, options);
    const responseCode = response.getResponseCode();
    
    Logger.log(`API Response Code: ${responseCode}`);
    
    if (responseCode !== 200) {
      Logger.log(`API Response: ${response.getContentText()}`);
      throw new Error(`API request failed with status ${responseCode}: ${response.getContentText()}`);
    }
    
    const responseData = JSON.parse(response.getContentText());
    Logger.log('API Response Data:', JSON.stringify(responseData, null, 2));
    
    if (!responseData.candidates || responseData.candidates.length === 0) {
      throw new Error('No response generated from Gemini');
    }
    
    // Extract text from response
    const rawText = responseData.candidates[0].content.parts[0].text;
    
    // Clean the response text to handle code blocks
    let cleanedText = rawText;
    
    // Remove code block markers if present
    const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (codeBlockMatch) {
      cleanedText = codeBlockMatch[1];
    }
    
    // Remove any leading/trailing whitespace and standalone curly braces
    cleanedText = cleanedText.trim().replace(/^{/, '').replace(/}$/, '');
    
    Logger.log('Cleaned response text:', cleanedText);
    return cleanedText;
    
  } catch (error) {
    Logger.log(`Error calling Gemini API: ${error.message}`);
    throw error;
  }
}

function parseJsonResponse(response, expectedAnswerCount) {
  try {
    Logger.log('Raw response:', response);

    // Try to find JSON in the response
    let jsonStr = response;
    
    // If response is wrapped in code blocks, extract it
    const jsonMatch = response.match(/```(?:json)?\s*({[\s\S]+?})\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Clean up any potential leading/trailing content
    jsonStr = jsonStr.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
    
    Logger.log('Cleaned JSON string:', jsonStr);

    // Parse the JSON
    const parsed = JSON.parse(jsonStr);
    Logger.log('Parsed JSON:', JSON.stringify(parsed, null, 2));
    
    // Extract all responses
    const responses = parsed.responses || [];
    Logger.log('Parsed responses count:', responses.length);

    // Ensure we have exactly the number of answers we need
    const resultAnswers = new Array(expectedAnswerCount).fill('No answer generated');
    responses.forEach((answer, index) => {
      if (index < expectedAnswerCount) {
        resultAnswers[index] = answer;
      }
    });

    Logger.log('Final processed answers:', resultAnswers.length);
    return resultAnswers;
  } catch (error) {
    Logger.log(`Error parsing JSON response: ${error.message}`);
    Logger.log('Raw response:', response);
    return new Array(expectedAnswerCount).fill('Error generating answer');
  }
}