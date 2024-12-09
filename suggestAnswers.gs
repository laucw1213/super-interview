function suggestAnswers(questions) {
  try {
    // Get API key from project properties
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('Gemini API key not found in script properties');
    }

    // Format prompt to request JSON response with realistic info
    const prompt = `Act as an expert sales professional and generate interview responses.

Return your response in this EXACT JSON format, and ONLY this format:
{
  "responses": [
    "Generate a realistic name",
    "Generate a realistic Hong Kong mobile number (+852 format)",
    "Generate a realistic email address matching the name",
    "detailed answer for fourth question",
    "detailed answer for fifth question",
    "etc..."
  ]
}

For each answer after the first three:
- Show strong negotiation skills and empathy
- Provide specific examples with metrics
- Keep responses professional and concise (150-200 words)
- Focus on demonstrating skills and experience
- Do not include any question text in the answers
- Make sure answers align with the questions asked
- Exclude any markdown formatting or extra text

Here are the questions:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;

    // Call Gemini API
    const response = callGeminiAPI(prompt, apiKey);
    
    // Parse JSON response
    const allAnswers = parseJsonResponse(response, questions.length);

    return {
      questions: questions,
      answers: allAnswers
    };

  } catch (error) {
    Logger.log(`Error in suggestAnswers: ${error.message}`);
    throw error;
  }
}

function callGeminiAPI(prompt, apiKey) {
  const apiEndpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`;
  
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
      maxOutputTokens: 2048
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
    
    return responseData.candidates[0].content.parts[0].text;
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