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

function generateAssessmentPrompt(categories, responses) {
  if (!categories || categories.length === 0) {
    Logger.log("❌ No categories found for assessment!");
    return null;
  }

  Logger.log("\n📝 Categories for Assessment:");
  categories.forEach(cat => Logger.log("- " + cat));

  // Filter out timestamp and contact info from responses
  const relevantResponses = Object.entries(responses).filter(([question]) => 
    !["Timestamp", "Mobile", "Name", "Email"].includes(question)
  );

  const tableHeader = "| Question Category | Scenario | This Candidate | Benchmark | Key Performance |";
  const tableDivider = "|---|---|---|---|---|";
  
  const promptText = `Please analyze these candidate responses and create an assessment table organized by Question Category. Follow these requirements exactly:

ASSESSMENT STRUCTURE REQUIREMENTS
------------------------------
1. Each row in the table represents EXACTLY ONE question and its response
2. Each Question Category must have EXACTLY 3 questions (3 rows) in the assessment table
3. Total number of rows in table must be ${categories.length * 3}
4. Questions must be grouped by Question Category in this exact order:
   ${categories.join('\n   ')}

ASSESSMENT FORMAT
---------------
PERFORMANCE ASSESSMENT TABLE
--------------------------
${tableHeader}
${tableDivider}

Assessment Guidelines:
1. Each row must correspond to one specific question - never combine multiple questions in one row
2. Group responses by Question Category - show all 3 questions for one category before moving to next
3. For each question row:
   - Scenario: Brief description of the question topic (2-4 words)
   - This Candidate: Score in X/10 format
   - Benchmark: Score in 0-9 format
   - Key Performance: Brief analysis of response
4. If a category has fewer than 3 responses:
   - Add rows with "No response" scenario and 0/10 score until category has 3 rows
   - Each added row must represent a distinct missing question
5. If a category has more than 3 responses:
   - Use only the first 3 distinct questions
6. Maintain exact table formatting and alignment

CANDIDATE RESPONSES
-----------------
${relevantResponses.map(([q, a], index) => `Response ${index + 1}:\nQuestion: ${q}\nAnswer: ${a}`).join('\n\n')}

DETAILED RESPONSES FORMAT
----------------------
After the table, list the detailed responses using this exact structure:

DETAILED RESPONSES
----------------
[For each row in the PERFORMANCE ASSESSMENT TABLE, in exact same order:]
Question: [Question from table row]
Answer: [Corresponding answer or "No answer generated" if none]

Critical Requirements for Detailed Responses:
1. MUST follow the exact same order as the PERFORMANCE ASSESSMENT TABLE
2. Include ALL questions from the table in the same order
3. List questions category by category, matching table organization
4. Each question must appear exactly once
5. Questions without responses must show "No answer generated"
6. Do not add any questions that aren't in the table
7. Do not skip any questions that are in the table`;

  return promptText;
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
      "zorro.cheng@hkmci.com"
    ].filter(Boolean).join(",");
    
    Logger.log(`Sending email to: ${defaultRecipients}`);

    var subject = `Candidate Assessment Report - ${formTitle} - ${candidateInfo.name}`;
    
    // Extract questions from the assessment table in order
    const tableContent = content.match(/PERFORMANCE ASSESSMENT TABLE[\s\S]*?(?=\n\nDETAILED RESPONSES|$)/);
    const orderedQuestions = [];
    
    if (tableContent) {
      const tableRows = tableContent[0].split('\n')
        .filter(row => row.includes('|'))
        .slice(2); // Skip header and divider rows
      
      // Extract scenarios from the table
      tableRows.forEach(row => {
        const cells = row.split('|');
        if (cells.length >= 3) {
          const category = cells[1].trim();
          const scenario = cells[2].trim();
          orderedQuestions.push({ category, scenario });
        }
      });
    }
    
    // Function to find the matching question from responses
    function findMatchingQuestion(scenario, responses) {
      const keywords = scenario.toLowerCase().split(' ');
      return Object.entries(responses).find(([question]) => 
        keywords.some(keyword => 
          question.toLowerCase().includes(keyword)
        )
      );
    }
    
    // Format responses in the same order as the table
    const formattedResponses = orderedQuestions
      .map(({ category, scenario }) => {
        const matchingResponse = findMatchingQuestion(scenario, responses);
        return matchingResponse 
          ? `Question: ${matchingResponse[0]}\nAnswer: ${matchingResponse[1]}`
          : `Question: ${category} - ${scenario}\nAnswer: No answer generated`;
      })
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