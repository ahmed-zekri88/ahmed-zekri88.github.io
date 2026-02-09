// Google Sheets Configuration
const CLIENT_ID = '1045013044828-g2hvpqced1tpmbdflq765j70shiog376.apps.googleusercontent.com'; // Get from Google Cloud Console
const API_KEY = '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'; // Get from Google Cloud Console
const SPREADSHEET_ID = 'https://docs.google.com/spreadsheets/d/11qES0V58qZcI0rRCZRkznkZqET7A4f_4oKHFtyVLPYw/edit'; // Get from your Google Sheet URL
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let tokenClient;
let gapiInited = false;
let gisInited = false;

// DOM Elements
const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');
const dateInput = document.getElementById('dateInput');
const descriptionInput = document.getElementById('descriptionInput');
const folderInput = document.getElementById('folderInput');
const authorizeButton = document.getElementById('authorize_button');
const signoutButton = document.getElementById('signout_button');
const loadFilesButton = document.getElementById('loadFiles');
const filesList = document.getElementById('filesList');

// Initialize current date
dateInput.valueAsDate = new Date();

// Initialize Google APIs
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableButtons();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        authorizeButton.style.display = 'block';
    }
}

// Authentication
function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        authorizeButton.style.display = 'none';
        signoutButton.style.display = 'inline-block';
        loadFilesButton.style.display = 'inline-block';
        await loadFiles();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        tokenClient.requestAccessToken({prompt: ''});
    }
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        authorizeButton.style.display = 'block';
        signoutButton.style.display = 'none';
        loadFilesButton.style.display = 'none';
        filesList.innerHTML = '<div class="loading">Please sign in to view files</div>';
    }
}

// File Upload Handler
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!gapi.client.getToken()) {
        showMessage('Please authorize Google Sheets first', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    if (!file) {
        showMessage('Please select a file', 'error');
        return;
    }
    
    try {
        // Read file as base64
        const base64File = await readFileAsBase64(file);
        
        // Prepare data for Google Sheets
        const rowData = [
            new Date().toISOString(), // Timestamp
            file.name,
            dateInput.value,
            descriptionInput.value,
            folderInput.value,
            file.type,
            (file.size / 1024).toFixed(2) + ' KB',
            base64File // Store file as base64 in sheet
        ];
        
        // Append to Google Sheet
        await appendToSheet(rowData);
        
        showMessage('File uploaded successfully!', 'success');
        uploadForm.reset();
        dateInput.valueAsDate = new Date();
        await loadFiles();
        
    } catch (error) {
        console.error('Upload error:', error);
        showMessage('Error uploading file: ' + error.message, 'error');
    }
});

// Helper function to read file as base64
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Google Sheets Operations
async function appendToSheet(rowData) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:H',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [rowData]
            }
        });
        return response;
    } catch (error) {
        console.error('Error appending to sheet:', error);
        throw error;
    }
}

async function loadFiles() {
    if (!gapi.client.getToken()) {
        filesList.innerHTML = '<div class="loading">Please sign in to view files</div>';
        return;
    }
    
    try {
        filesList.innerHTML = '<div class="loading">Loading files...</div>';
        
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:H',
        });
        
        const rows = response.result.values;
        if (!rows || rows.length === 0) {
            filesList.innerHTML = '<div class="loading">No files found. Upload your first file!</div>';
            return;
        }
        
        displayFiles(rows.slice(1)); // Skip header row
    } catch (error) {
        console.error('Error loading files:', error);
        filesList.innerHTML = '<div class="error">Error loading files: ' + error.message + '</div>';
    }
}

function displayFiles(rows) {
    if (rows.length === 0) {
        filesList.innerHTML = '<div class="loading">No files found</div>';
        return;
    }
    
    filesList.innerHTML = '';
    
    rows.forEach((row, index) => {
        const [timestamp, fileName, date, description, folder, fileType, fileSize, base64Data] = row;
        
        const fileCard = document.createElement('div');
        fileCard.className = 'file-card';
        
        fileCard.innerHTML = `
            <h3>${fileName}</h3>
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Description:</strong> ${description}</p>
            <p><strong>Folder:</strong> ${folder}</p>
            <p><strong>Type:</strong> ${fileType}</p>
            <p><strong>Size:</strong> ${fileSize}</p>
            <div class="file-actions">
                <button class="btn open-btn" onclick="openFile('${fileName}', '${fileType}', '${base64Data}')">
                    Open File
                </button>
                <button class="btn delete-btn" onclick="deleteFile(${index + 2})">
                    Delete
                </button>
            </div>
        `;
        
        filesList.appendChild(fileCard);
    });
}

function openFile(fileName, fileType, base64Data) {
    // Create a blob from base64 data
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: fileType });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function deleteFile(rowNumber) {
    if (!confirm('Are you sure you want to delete this file?')) return;
    
    try {
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: 0,
                            dimension: 'ROWS',
                            startIndex: rowNumber - 1,
                            endIndex: rowNumber
                        }
                    }
                }]
            }
        });
        
        showMessage('File deleted successfully', 'success');
        await loadFiles();
    } catch (error) {
        console.error('Error deleting file:', error);
        showMessage('Error deleting file: ' + error.message, 'error');
    }
}

// Utility Functions
function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = type;
    messageDiv.textContent = message;
    
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.success, .error');
    existingMessages.forEach(msg => msg.remove());
    
    // Add new message after the upload form
    uploadForm.parentNode.insertBefore(messageDiv, uploadForm.nextSibling);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 5000);
}

// Event Listeners
authorizeButton.onclick = handleAuthClick;
signoutButton.onclick = handleSignoutClick;
loadFilesButton.onclick = loadFiles;

// Initialize
window.gapiLoaded = gapiLoaded;
window.gisLoaded = gisLoaded;