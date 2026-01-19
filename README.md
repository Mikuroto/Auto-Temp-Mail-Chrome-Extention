# Auto Temp Mail - Chrome Extension

Chrome extension for automatic temporary email generation and verification code extraction.

## Features

- 📧 Generate temporary email addresses
- 📥 Automatically receive and display incoming emails
- 🔢 Extract verification codes from emails
- ✏️ Auto-fill email fields on web pages
- 📋 Copy email/codes to clipboard

## Installation

### 1. Get API Key

This extension uses [Boomlify](https://boomlify.com) API for temporary emails. Get your API key from their service.

### 2. Configure

1. Copy `config.example.js` to `config.js`
2. Replace `YOUR_API_KEY_HERE` with your actual API key:

```javascript
const CONFIG = {
  API_KEY: "your_actual_api_key",
  API_BASE_URL: "https://v1.boomlify.com",
};
```

### 3. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right corner)
3. Click "Load unpacked"
4. Select the extension folder

## Usage

1. Click the extension icon in Chrome toolbar
2. Click "Generate New Email" to create a temporary email
3. Use "Fill Email" button to auto-fill email fields on current page
4. Incoming messages will appear automatically
5. Click on verification codes to copy them

## Files

- `manifest.json` - Extension configuration
- `background.js` - Background service worker
- `content.js` - Content script for page interaction
- `popup.html/js` - Extension popup UI
- `styles.css` - Popup styles
- `config.js` - API configuration (not tracked in git)

## License

MIT
