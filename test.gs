function onFormSubmit(e) {
  var responses = {};
  var namedValues = e.namedValues;
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var spreadsheetUrl = spreadsheet.getUrl();
  var formTitle = spreadsheet.getName();
  
  var candidateInfo = {
    name: namedValues["Name"] ? namedValues["Name"][0] : "N/A",
    mobile: namedValues["Mobile Number"] ? namedValues["Mobile Number"][0] : "N/A",
    email: namedValues["Email"] ? namedValues["Email"][0] : "N/A"
  };
  
  for (var question in namedValues) {
    if (namedValues[question] && namedValues[question].length > 0 && 
        !["Name", "Mobile Number", "Email"].includes(question)) {
      responses[question] = namedValues[question][0];
    }
  }

  if (Object.keys(responses).length === 0) {
    Logger.log("No responses found");
    return;
  }

  var formattedResponses = Object.entries(responses)
    .map(([q, a]) => `Question: ${q}\nAnswer: ${a}`)
    .join('\n\n');

  var apiKey = "AIzaSyB0xf4Fz4rfJkxulI8FdSigeta-y9EdcI4";
  var apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
  var url = apiUrl + "?key=" + apiKey;

  var headers = {
    "Content-Type": "application/json"
  };

  var promptText = `Please analyze these candidate responses for sales ability, negotiation skills, and empathy. 
  First provide a structured scoring table comparing the candidate's performance to industry benchmarks in this format:
  
  Score Comparison Table
  Question Category | Scenario | This Candidate | Medium Benchmark | High Benchmark
  Negotiation Skills | Price Increase Negotiation | X/10 | 6/10 | 9/10
  ... (continue for all scenarios)
  Overall Average | X/10 | 6.5/10 | 9.5/10
  
  Then provide a detailed assessment with scores out of 10 for each category and justification.

  Here are the responses to analyze:
  ${formattedResponses}`;

  var requestBody = {
    "contents": [{
      "role": "user",
      "parts": [{"text": promptText}]
    }],
    "generationConfig": {
      "temperature": 1,
      "topP": 0.95,
      "topK": 40,
      "maxOutputTokens": 8192
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
    sendEmailReport(output, formattedResponses, spreadsheetUrl, formTitle, candidateInfo);

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

function sendEmailReport(content, rawResponses, spreadsheetUrl, formTitle, candidateInfo) {
  try {
    // 从 Spreadsheet 获取所有者邮箱
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const recipient = spreadsheet.getOwner().getEmail();
    
    Logger.log(`Using spreadsheet owner email: ${recipient}`);

    var subject = `Candidate Assessment Report - ${formTitle} - ${candidateInfo.name}`;
    var body = `
==============================================
CANDIDATE ASSESSMENT REPORT
==============================================

CANDIDATE INFORMATION
-------------------
Name:   ${candidateInfo.name}
Mobile: ${candidateInfo.mobile}
Email:  ${candidateInfo.email}

${content}

DETAILED RESPONSES
----------------
${rawResponses}

-------------------
Results Sheet: ${spreadsheetUrl}
==============================================`;

    GmailApp.sendEmail(recipient, subject, body, {
      htmlBody: body.replace(/\n/g, '<br>')
    });
    
    Logger.log(`Successfully sent email to: ${recipient}`);
    
  } catch (error) {
    Logger.log(`Error in sendEmailReport: ${error.toString()}`);
    // 记录错误但继续执行
  }
}

function testOnFormSubmit() {
  var fakeEvent = {
    namedValues: {
      "Name": ["John Doe"],
      "Mobile Number": ["12345678"],
      "Email": ["john@example.com"],
      "Question 1": ["Sample response 1"],
      "Question 2": ["Sample response 2"]
    }
  };
  onFormSubmit(fakeEvent);
}