function doGet() {
  return HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
          }
          .container { 
            max-width: 800px; 
            margin: 0 auto; 
          }
          .file-upload {
            border: 2px dashed #4285f4;
            padding: 20px;
            text-align: center;
            border-radius: 4px;
            margin-bottom: 20px;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          .file-upload.dragover {
            background-color: #e8f0fe;
            border-color: #357abd;
          }
          #uploadStatus {
            margin-top: 10px;
            color: #666;
          }
          .result {
            margin-top: 20px;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            display: none;
            background: #f8f9fa;
          }
          .result h3 {
            margin-top: 0;
            color: #1a73e8;
          }
          .link-container {
            background: white;
            padding: 15px;
            border-radius: 4px;
            margin: 10px 0;
            border: 1px solid #e0e0e0;
          }
          .link-label {
            font-weight: 500;
            color: #202124;
            margin-bottom: 8px;
          }
          .link-url {
            word-break: break-all;
            color: #1a73e8;
          }
          .error {
            color: #f44336;
            margin-top: 10px;
            display: none;
            padding: 10px;
            border: 1px solid #ffcdd2;
            border-radius: 4px;
            background-color: #ffebee;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>File Upload & Form Generator</h1>
          
          <div class="file-upload" id="dropZone">
            <div>Drop files here or click to upload</div>
            <input type="file" id="fileInput" style="display: none;">
            <div id="uploadStatus"></div>
          </div>
          
          <div id="error" class="error"></div>
          <div id="result" class="result">
            <h3>Generated Links</h3>
            
            <div class="link-container">
              <div class="link-label">Form URL:</div>
              <a id="formLink" class="link-url" href="#" target="_blank"></a>
            </div>
            
            <div class="link-container">
              <div class="link-label">Spreadsheet URL:</div>
              <a id="sheetLink" class="link-url" href="#" target="_blank"></a>
            </div>
          </div>
        </div>

        <script>
          const dropZone = document.getElementById('dropZone');
          const fileInput = document.getElementById('fileInput');
          const uploadStatus = document.getElementById('uploadStatus');
          const resultDiv = document.getElementById('result');
          
          dropZone.addEventListener('click', () => fileInput.click());
          
          dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
          });
          
          dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
          });
          
          dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length) handleFile(files[0]);
          });
          
          fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) handleFile(e.target.files[0]);
          });
          
          function handleFile(file) {
            uploadStatus.textContent = 'Processing...';
            resultDiv.style.display = 'none';
            
            const reader = new FileReader();
            reader.onload = function(e) {
              const content = e.target.result;
              
              google.script.run
                .withSuccessHandler(function(result) {
                  if (result.error) {
                    showError(result.error);
                    uploadStatus.textContent = 'Processing failed';
                    return;
                  }
                  uploadStatus.textContent = 'Processing complete!';
                  resultDiv.style.display = 'block';
                  
                  const formLink = document.getElementById('formLink');
                  formLink.href = result.prefilledUrl;
                  formLink.textContent = result.prefilledUrl;
                  
                  const sheetLink = document.getElementById('sheetLink');
                  sheetLink.href = result.sheetUrl;
                  sheetLink.textContent = result.sheetUrl;
                })
                .withFailureHandler(function(error) {
                  showError(error.message || 'Processing failed');
                  uploadStatus.textContent = 'Processing failed';
                })
                .uploadAndProcess(content, file.name);
            };
            
            reader.onerror = function() {
              showError('Failed to read file');
              uploadStatus.textContent = 'Processing failed';
            };
            
            reader.readAsDataURL(file);
          }

          function showError(message) {
            const errorDiv = document.getElementById('error');
            errorDiv.style.display = 'block';
            errorDiv.textContent = message;
            setTimeout(() => {
              errorDiv.style.display = 'none';
            }, 5000);
          }
        </script>
      </body>
    </html>
  `).setTitle('File Upload & Form Generator').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function uploadAndProcess(content, filename) {
  try {
    // Decode base64 content
    const contentStr = content.split(',')[1];
    const blob = Utilities.newBlob(Utilities.base64Decode(contentStr), null, filename);
    
    // Upload to target folder
    let file;
    if (CONFIG.TARGET_FOLDER_ID) {
      const folder = DriveApp.getFolderById(CONFIG.TARGET_FOLDER_ID);
      file = folder.createFile(blob);
    } else {
      file = DriveApp.createFile(blob);
    }
    
    // Convert to Google Doc if it's not already
    const fileId = file.getId();
    const mimeType = file.getMimeType();
    
    if (mimeType !== MimeType.GOOGLE_DOCS) {
      const resource = {
        title: file.getName(),
        mimeType: MimeType.GOOGLE_DOCS
      };
      const convertedFile = Drive.Files.copy(resource, fileId);
      DriveApp.getFileById(fileId).setTrashed(true);
      CONFIG.QUESTIONS_DOC_ID = convertedFile.id;
    } else {
      CONFIG.QUESTIONS_DOC_ID = fileId;
    }
    
    // Wait for file processing
    Utilities.sleep(2000);
    
    // Try to access the document with retries
    let maxRetries = 3;
    let retryCount = 0;
    let lastError;
    
    while (retryCount < maxRetries) {
      try {
        // Run main function
        const result = main();
        return {
          fileId: CONFIG.QUESTIONS_DOC_ID,
          prefilledUrl: result.prefilledUrl
        };
      } catch (error) {
        lastError = error;
        retryCount++;
        if (retryCount < maxRetries) {
          // Wait longer between each retry
          Utilities.sleep(2000 * retryCount);
        }
      }
    }
    
    // If we get here, all retries failed
    throw lastError;
    
  } catch (error) {
    Logger.log('Process error: ' + error.toString());
    return {
      error: error.message || '处理失败'
    };
  }
}