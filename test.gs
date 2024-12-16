function logAspectsSheet() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Aspects");
    if (!sheet) {
      Logger.log("❌ Aspects sheet not found!");
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    
    Logger.log("\n📊 Aspects Sheet Contents:");
    Logger.log("------------------------");
    
    // Log headers
    Logger.log("Headers: " + data[0].filter(header => header !== "").join(" | "));
    
    // Log all data with row numbers
    data.forEach((row, index) => {
      if (index === 0) return; // Skip header row
      const rowNum = index + 1;
      const rowData = row.map(cell => cell || "").join(" | ");
      Logger.log(`Row ${rowNum}: ${rowData}`);
    });
    
    // Create a visual representation of the sheet
    Logger.log("\n📋 Sheet Visual Structure:");
    Logger.log("------------------------");
    const visualSheet = data.map(row => 
      row.map(cell => cell || "(empty)").join(" | ")
    ).join("\n");
    Logger.log(visualSheet);
    
    return data;
  } catch (error) {
    Logger.log("❌ Error logging Aspects sheet: " + error);
    return null;
  }
}

function getAspectsFromSheet() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Aspects");
    if (!sheet) {
      Logger.log("❌ Aspects sheet not found!");
      return null;
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) {
      Logger.log("❌ Aspects sheet is empty!");
      return null;
    }

    // Get only the headers (first row)
    const headers = data[0].filter(header => header !== "");
    
    Logger.log("\n📊 Aspects Sheet Headers:");
    Logger.log(headers.join(" | "));
    
    if (headers.length === 0) {
      Logger.log("❌ No headers found in Aspects sheet!");
      return null;
    }

    return headers;
  } catch (error) {
    Logger.log("❌ Error in getAspectsFromSheet: " + error);
    return null;
  }
}

function getQuestionsPerAspect(responses) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Aspects");
  if (!sheet) {
    Logger.log("❌ Aspects sheet not found!");
    return null;
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const aspects = headers.filter(header => header !== "");
  
  // Get the form to access questions in original order
  const form = FormApp.openByUrl(SpreadsheetApp.getActiveSpreadsheet().getFormUrl());
  const formItems = form.getItems();
  
  // Filter and sort questions maintaining form order
  const questions = formItems
    .filter(item => item.getType() !== FormApp.ItemType.SECTION_HEADER)
    .map(item => item.getTitle())
    .filter(q => !["Timestamp", "Mobile", "Name", "Email"].includes(q));
  
  const questionsPerAspect = Math.floor(questions.length / aspects.length);
  
  return {
    aspects,
    questionsPerAspect,
    totalQuestions: questions.length,
    orderedQuestions: questions // Return the ordered questions
  };
}

function generateAssessmentPrompt(categories, responses) {
  if (!categories || categories.length === 0) {
    Logger.log("❌ No categories found for assessment!");
    return null;
  }

  Logger.log("\n📝 Categories for Assessment:");
  categories.forEach(cat => Logger.log("- " + cat));

  // Get questions in original form order
  const form = FormApp.openByUrl(SpreadsheetApp.getActiveSpreadsheet().getFormUrl());
  const formItems = form.getItems();
  const orderedQuestions = formItems
    .filter(item => item.getType() !== FormApp.ItemType.SECTION_HEADER)
    .map(item => item.getTitle())
    .filter(q => !["Timestamp", "Mobile", "Name", "Email"].includes(q));

  // Create ordered responses array maintaining form order
  const orderedResponses = orderedQuestions.map(question => [
    question,
    responses[question] || ''
  ]);

  // Calculate questions per category
  const questionsPerCategory = Math.floor(orderedQuestions.length / categories.length);

  // Create category mapping based on form order
  let categoryMapping = "";
  let startIndex = 0;
  categories.forEach((category, index) => {
    const endIndex = startIndex + questionsPerCategory;
    const categoryQuestions = orderedQuestions.slice(startIndex, endIndex);
    
    categoryMapping += `\n${category}:\n`;
    categoryQuestions.forEach((q, qIndex) => {
      categoryMapping += `${qIndex + 1}. ${q}\n`;
    });
    startIndex = endIndex;
  });

  Logger.log("\n📋 Questions mapped to categories:");
  Logger.log(categoryMapping);

  const promptText = `Please analyze these candidate responses and create an assessment table following these EXACT requirements:

STRICT CATEGORY-QUESTION MAPPING
------------------------------
These questions MUST be assessed under their assigned categories - do not change this mapping:
${categoryMapping}

ASSESSMENT STRUCTURE REQUIREMENTS
------------------------------
1. Each category MUST have exactly ${questionsPerCategory} questions assessed
2. Questions MUST be assessed in the exact order shown above
3. Do not combine or skip any questions
4. Total rows in table must be ${orderedQuestions.length}
5. Questions must remain in their assigned categories - no moving questions between categories

ASSESSMENT FORMAT
---------------
PERFORMANCE ASSESSMENT TABLE
--------------------------
| Question Category | Scenario | This Candidate | Benchmark | Key Performance |
|---|---|---|---|---|

For each question:
1. Question Category: Use exact category name from mapping
2. Scenario: Brief description of question topic (2-4 words)
3. This Candidate: Score in X/10 format
4. Benchmark: Expected score in 0-9 format
5. Key Performance: Brief analysis of response

CANDIDATE RESPONSES
-----------------
${orderedResponses.map(([q, a], index) => `Response ${index + 1}:\nQuestion: ${q}\nAnswer: ${a}`).join('\n\n')}

DETAILED RESPONSES FORMAT
----------------------
After the table, list the detailed responses in the EXACT SAME ORDER as the category-question mapping above:

DETAILED RESPONSES
----------------
[List each question and answer in the exact order shown in the category mapping above]
Question: [Question text]
Answer: [Corresponding answer]`;

  Logger.log("\n✅ Prompt Generation Complete");
  Logger.log("📊 Questions per category:", questionsPerCategory);
  
  return promptText;
}

function getQuestionsPerAspect(responses) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Aspects");
  if (!sheet) {
    Logger.log("❌ Aspects sheet not found!");
    return null;
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const aspects = headers.filter(header => header !== "");
  
  // Get all questions except personal info
  const questions = Object.keys(responses).filter(q => 
    !["Timestamp", "Mobile", "Name", "Email"].includes(q)
  );
  
  const questionsPerAspect = Math.floor(questions.length / aspects.length);
  
  return {
    aspects,
    questionsPerAspect,
    totalQuestions: questions.length
  };
}

function onFormSubmit(e) {
  var responses = {};
  var namedValues = e.namedValues;
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var spreadsheetUrl = spreadsheet.getUrl();
  var formTitle = spreadsheet.getName();
  
  var candidateInfo = {
    name: namedValues["Name"] ? namedValues["Name"][0] : "N/A",
    mobile: namedValues["Mobile"] ? namedValues["Mobile"][0] : "N/A",
    email: namedValues["Email"] ? namedValues["Email"][0] : "N/A"
  };
  
  for (var question in namedValues) {
    if (namedValues[question] && namedValues[question].length > 0) {
      responses[question] = namedValues[question][0];
    }
  }

  if (Object.keys(responses).length === 0) {
    Logger.log("No responses found");
    return;
  }

  const categories = getAspectsFromSheet();
  if (!categories) {
    Logger.log("❌ Failed to get categories from sheet. Cannot proceed with assessment.");
    return;
  }

  const promptText = generateAssessmentPrompt(categories, responses);
  if (!promptText) {
    Logger.log("❌ Failed to generate assessment prompt. Cannot proceed.");
    return;
  }

  var apiKey = "AIzaSyB0xf4Fz4rfJkxulI8FdSigeta-y9EdcI4";
  var apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
  var url = apiUrl + "?key=" + apiKey;

  var headers = {
    "Content-Type": "application/json"
  };

  var requestBody = {
    "contents": [{
      "role": "user",
      "parts": [{"text": promptText}]
    }],
    "generationConfig": {
      "temperature": 0.7,
      "topP": 0.8,
      "topK": 40,
      "maxOutputTokens": 8192,
      "stopSequences": ["DETAILED RESPONSES"] // Add this to prevent extra content
    }
  };

  var options = {
    "method": "POST",
    "headers": headers,
    "payload": JSON.stringify(requestBody),
    "muteHttpExceptions": true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var data = JSON.parse(response.getContentText());

    if (response.getResponseCode() !== 200) {
      Logger.log("Error during API call: " + JSON.stringify(data.error));
      return;
    }

    var output = data.candidates ? data.candidates[0].content.parts[0].text : null;
    if (!output) {
      Logger.log("No content returned by Gemini API");
      return;
    }

    Logger.log("Generated Report: \n" + output);
    saveToSheet(output, responses, candidateInfo);
    sendEmailReport(output, responses, spreadsheetUrl, formTitle, candidateInfo, categories);

  } catch (error) {
    Logger.log("Exception during API call: " + error);
  }
}

function saveToSheet(content, responses, candidateInfo) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Reports");
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Reports");
      sheet.appendRow(["Timestamp", "Name", "Mobile", "Email", "Assessment Report", "Raw Responses"]);
    }
    var timestamp = new Date();
    sheet.appendRow([
      timestamp, 
      candidateInfo.name,
      candidateInfo.mobile,
      candidateInfo.email,
      content, 
      JSON.stringify(responses)
    ]);
  } catch (error) {
    Logger.log("Error saving to sheet: " + error);
  }
}

function sendEmailReport(content, responses, spreadsheetUrl, formTitle, candidateInfo, categories) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const owner = spreadsheet.getOwner().getEmail();
    
    const defaultRecipients = [
      owner,
      "alfred.lau@gemini.demo.hkmci.com"
    ].filter(Boolean).join(",");
    
    Logger.log(`Sending email to: ${defaultRecipients}`);

    var subject = `Candidate Assessment Report - ${formTitle} - ${candidateInfo.name}`;

    // Get form questions in original order
    const form = FormApp.openByUrl(spreadsheet.getFormUrl());
    const formItems = form.getItems();
    const formQuestions = formItems
      .filter(item => item.getType() !== FormApp.ItemType.SECTION_HEADER)
      .map(item => item.getTitle())
      .filter(title => !["Name", "Mobile", "Email"].includes(title));

    // Extract assessment table content
    const tableContent = content.match(/PERFORMANCE ASSESSMENT TABLE[\s\S]*?(?=\n\nDETAILED RESPONSES|$)/);
    let tableRows = [];
    
    if (tableContent) {
      tableRows = tableContent[0].split('\n')
        .filter(row => row.includes('|'))
        .slice(2); // Skip header and divider rows
    }

    // Create a map of scenarios and their categories from the table
    const scenarioMap = new Map();
    tableRows.forEach(row => {
      const cells = row.split('|');
      if (cells.length >= 3) {
        const category = cells[1].trim();
        const scenario = cells[2].trim();
        scenarioMap.set(scenario, category);
      }
    });

    // Match form questions with table scenarios
    const matchedResponses = formQuestions.map(question => {
      // Find the most relevant scenario for this question
      let bestMatch = null;
      let bestMatchScore = 0;

      scenarioMap.forEach((category, scenario) => {
        const questionWords = question.toLowerCase().split(' ');
        const scenarioWords = scenario.toLowerCase().split(' ');
        
        // Count matching significant words
        const matchScore = questionWords.reduce((score, word) => {
          if (word.length > 3 && scenarioWords.includes(word)) {
            score += 1;
          }
          return score;
        }, 0);

        if (matchScore > bestMatchScore) {
          bestMatchScore = matchScore;
          bestMatch = { scenario, category };
        }
      });

      return {
        question,
        category: bestMatch?.category || 'Uncategorized',
        scenario: bestMatch?.scenario || question.slice(0, 30),
        answer: responses[question] || 'No answer provided'
      };
    });

    // Format the detailed responses section using the original question order
    const formattedResponses = matchedResponses
      .map(({ question, answer }) => 
        `Question: ${question}\nAnswer: ${answer}`
      )
      .join('\n\n');
    
    var body = `
==============================================
CANDIDATE ASSESSMENT REPORT
==============================================

CANDIDATE INFORMATION
-------------------
Name:   ${candidateInfo.name}
Mobile: ${candidateInfo.mobile}
Email:  ${candidateInfo.email}

EVALUATION CATEGORIES
-------------------
${categories.join('\n')}

ASSESSMENT
---------
${content}

DETAILED RESPONSES
----------------
${formattedResponses}

-------------------
Results Sheet: ${spreadsheetUrl}
==============================================`;

    // Convert the markdown table to HTML for email
    var htmlBody = body.replace(/\n/g, '<br>');
    htmlBody = htmlBody.replace(
      /PERFORMANCE ASSESSMENT TABLE\s*-+\s*\|([\s\S]*?)(?=\n\n)/g,
      (match, table) => {
        const rows = table.split('\n').filter(row => row.trim());
        const htmlRows = rows.map(row => {
          const cells = row.split('|').filter(cell => cell.trim());
          return `<tr>${cells.map(cell => 
            `<td style="padding: 8px; border: 1px solid #ddd;">${cell.trim()}</td>`
          ).join('')}</tr>`;
        });
        return `
          <h3>PERFORMANCE ASSESSMENT TABLE</h3>
          <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
            ${htmlRows.join('\n')}
          </table>
        `;
      }
    );

    // Add email options
    var emailOptions = {
      htmlBody: htmlBody,
      name: "HR Assessment System"
    };

    // Send email using defaultRecipients
    GmailApp.sendEmail(defaultRecipients, subject, body, emailOptions);
    
    Logger.log(`Successfully sent email to: ${defaultRecipients}`);
    
  } catch (error) {
    Logger.log(`Error in sendEmailReport: ${error}`);
    throw error;
  }
}

function testOnFormSubmit() {
  var fakeEvent = {
    namedValues: {
      "Name": ["John Doe"],
      "Mobile": ["12345678"],
      "Email": ["john@example.com"],
      "Question 1": ["Sample response 1"],
      "Question 2": ["Sample response 2"]
    }
  };
  onFormSubmit(fakeEvent);
}