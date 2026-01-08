// Background script for Auto Temp Mail
import { CONFIG } from './config.js';

const API_BASE_URL = CONFIG.API_BASE_URL;
const API_KEY = CONFIG.API_KEY;

let currentEmail = null;
let currentEmailId = null;
let pollingInterval = null;
let lastMessageId = null;
let emailCreatedAt = null;
let allMessages = []; // Store all messages

// Initialize state from storage
chrome.storage.local.get(['email', 'emailId', 'lastMessageId', 'createdAt', 'messages'], (result) => {
  if (result.email && result.emailId) {
    // Check if expired (10 mins = 600000 ms)
    const now = Date.now();
    const created = result.createdAt || now;
    if (now - created < 600000) {
      currentEmail = result.email;
      currentEmailId = result.emailId;
      lastMessageId = result.lastMessageId;
      emailCreatedAt = created;
      allMessages = result.messages || [];
      startPolling(currentEmailId);
    } else {
      // Expired, clear storage
      clearState();
    }
  }
});

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateEmail') {
    createEmail().then(sendResponse);
    return true;
  } else if (request.action === 'getCurrentState') {
    sendResponse({ email: currentEmail, emailId: currentEmailId, messages: allMessages });
  } else if (request.action === 'deleteEmail') {
    clearState();
    sendResponse({ success: true });
  } else if (request.action === 'fillEmail') {
    // Manually trigger fill email on active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'fillEmail',
          email: currentEmail
        }, (response) => {
          if (chrome.runtime.lastError) {
            // Ignore error
          }
        });
      }
    });
    sendResponse({ success: true });
  }
});

function clearState() {
  currentEmail = null;
  currentEmailId = null;
  lastMessageId = null;
  emailCreatedAt = null;
  allMessages = [];
  stopPolling();
  chrome.storage.local.clear();
}

async function createEmail() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/emails/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.email) {
      currentEmail = data.email.address;
      currentEmailId = data.email.id;
      emailCreatedAt = Date.now();
      lastMessageId = null;
      allMessages = []; // Clear messages on new email

      // Save to storage
      chrome.storage.local.set({
        email: currentEmail,
        emailId: currentEmailId,
        createdAt: emailCreatedAt,
        lastMessageId: null,
        messages: []
      });

      startPolling(currentEmailId);

      // Notify content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'fillEmail',
            email: currentEmail
          }, (response) => {
            if (chrome.runtime.lastError) {
              // Ignore error
            }
          });
        }
      });

      return { success: true, email: currentEmail };
    } else {
      throw new Error('Invalid response format');
    }

  } catch (error) {
    console.error('Error creating email:', error);
    return { success: false, error: error.message };
  }
}

function startPolling(emailId) {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(() => checkMessages(emailId), 5000);
}

function stopPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = null;
}

async function checkMessages(emailId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/emails/${emailId}/messages`, {
      headers: { 'X-API-Key': API_KEY }
    });

    if (!response.ok) return;

    const data = await response.json();
    const messages = Array.isArray(data) ? data : (data.messages || []);

    if (messages.length > 0) {
      const latestMessage = messages[0];

      if (latestMessage.id !== lastMessageId) {
        lastMessageId = latestMessage.id;
        // Update storage
        chrome.storage.local.set({ lastMessageId: lastMessageId });
        processMessage(latestMessage);
      }
    }
  } catch (error) {
    console.error('Polling error:', error);
  }
}

function processMessage(message) {
  console.log('=== NEW MESSAGE ===');
  console.log('Message:', message);

  // Add message to the beginning of array (newest first)
  allMessages.unshift(message);

  // Save messages to storage
  chrome.storage.local.set({ messages: allMessages });

  // Broadcast all messages to popup
  broadcastAllMessages();

  // Auto-fill code if found (still try to extract codes)
  const subject = message.subject || '';
  const textBody = message.body_text || message.text_body || '';
  const htmlBody = message.body_html || message.html_body || '';
  const content = subject + '\n' + textBody + '\n' + htmlBody;

  const codeMatch = content.match(/\b\d{4,8}\b/);
  if (codeMatch) {
    const code = codeMatch[0];
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'fillCode',
          code: code
        }, (response) => {
          if (chrome.runtime.lastError) {
            // Ignore error
          }
        });
      }
    });
  }
}

function broadcastAllMessages() {
  chrome.runtime.sendMessage({
    action: 'allMessages',
    data: allMessages
  }, (response) => {
    if (chrome.runtime.lastError) {
      // Ignore error if popup is closed
    }
  });
}
