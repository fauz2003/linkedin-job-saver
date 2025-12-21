// Get references to buttons and status div
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');

// Listen for status messages from the content script
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'STATUS') {
    if (msg.status === 'RUNNING') {
      statusDiv.textContent = `STATUS: RUNNING${msg.jobsSaved ? ` (${msg.jobsSaved} saved)` : ''}`;
    } else if (msg.status === 'STOPPED') {
      statusDiv.textContent = `STATUS: STOPPED${msg.jobsSaved ? ` (${msg.jobsSaved} saved)` : ''}`;
    }
  } else if (msg.type === 'SAVED') {
    statusDiv.textContent = `STATUS: RUNNING (${msg.jobsSaved} saved)`;
  }
});

// Function to send message to content script
function sendMessage(action) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) return;
    const tab = tabs[0];

    // Ensure we're on a LinkedIn Jobs page which the content script runs on
    if (!tab.url || !tab.url.includes('linkedin.com/jobs')) {
      statusDiv.textContent = 'STATUS: OPEN A LINKEDIN JOBS PAGE';
      return;
    }

    // Send a message and handle the case where no content script is present
    chrome.tabs.sendMessage(tab.id, { command: action }, (response) => {
      if (chrome.runtime.lastError) {
        // Receiving end does not exist — try injecting the content script
        console.warn('sendMessage error:', chrome.runtime.lastError.message);
        statusDiv.textContent = 'STATUS: INJECTING CONTENT SCRIPT...';

        // Use scripting.executeScript to inject content.js, then resend the message
        chrome.scripting.executeScript(
          { target: { tabId: tab.id }, files: ['content.js'] },
          () => {
            if (chrome.runtime.lastError) {
              console.error('Injection failed:', chrome.runtime.lastError.message);
              statusDiv.textContent = 'STATUS: INJECTION FAILED';
              return;
            }

            // After injection, resend the original command
                chrome.tabs.sendMessage(tab.id, { command: action }, (resp) => {
                  if (chrome.runtime.lastError) {
                    console.error('sendMessage after injection failed:', chrome.runtime.lastError.message);
                    statusDiv.textContent = 'STATUS: NO CONTENT SCRIPT';
                  }
                });
          }
        );
      }
    });
  });
}

// Start button
startBtn.addEventListener('click', () => {
  sendMessage('START');
  statusDiv.textContent = 'STATUS: STARTING...';
});

// Stop button
stopBtn.addEventListener('click', () => {
  sendMessage('STOP');
  statusDiv.textContent = 'STATUS: STOPPING...';
});
