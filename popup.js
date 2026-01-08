document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.getElementById('email-input');
    const generateBtn = document.getElementById('generate-btn');
    const fillBtn = document.getElementById('fill-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const copyBtn = document.getElementById('copy-btn');
    const messageDisplay = document.getElementById('message-display');

    // Initialize state
    chrome.runtime.sendMessage({ action: 'getCurrentState' }, (response) => {
        if (response && response.email) {
            emailInput.value = response.email;
            updateButtons(true);
            // Render saved messages
            if (response.messages && response.messages.length > 0) {
                renderMessages(response.messages);
            }
        } else {
            updateButtons(false);
        }
    });

    function updateButtons(hasEmail) {
        generateBtn.disabled = false;
        fillBtn.disabled = !hasEmail;
        deleteBtn.disabled = !hasEmail;
        copyBtn.disabled = !hasEmail;

        if (!hasEmail) {
            emailInput.value = '';
            messageDisplay.innerHTML = '<div class="no-messages">Waiting for email generation...</div>';
        }
    }

    // Generate Email
    generateBtn.addEventListener('click', () => {
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';

        chrome.runtime.sendMessage({ action: 'generateEmail' }, (response) => {
            generateBtn.textContent = 'Generate New Email';
            generateBtn.disabled = false;

            if (response.success) {
                emailInput.value = response.email;
                messageDisplay.innerHTML = '<div class="no-messages">Waiting for messages...</div>';
                updateButtons(true);
            } else {
                messageDisplay.textContent = 'Error: ' + response.error;
            }
        });
    });

    // Fill Email
    fillBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'fillEmail' });
    });

    // Delete Email
    deleteBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'deleteEmail' }, () => {
            updateButtons(false);
        });
    });

    // Copy Email
    copyBtn.addEventListener('click', () => {
        if (emailInput.value) {
            navigator.clipboard.writeText(emailInput.value);
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✓';
            setTimeout(() => copyBtn.textContent = originalText, 1000);
        }
    });

    // Listen for updates
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'allMessages') {
            renderMessages(request.data);
        }
    });

    function renderMessages(messages) {
        if (!messages || messages.length === 0) {
            messageDisplay.innerHTML = '<div class="no-messages">No messages yet</div>';
            return;
        }

        let html = '<div class="messages-list">';

        messages.forEach((msg, index) => {
            const isLatest = index === 0;
            const subject = msg.subject || 'No subject';
            const from = msg.from_email || 'Unknown sender';
            const textBody = msg.body_text || msg.text_body || '';
            const htmlBody = msg.body_html || msg.html_body || '';
            let body = textBody || htmlBody || 'No content';

            // Clean up excessive line breaks (limit to max 2 consecutive)
            body = body.replace(/\n{3,}/g, '\n\n');

            // Make URLs clickable - do this BEFORE escaping HTML
            const bodyWithLinks = linkifyText(body);

            html += `
        <div class="message-item ${isLatest ? 'expanded' : 'collapsed'}" data-index="${index}">
          <div class="message-header">
            <div class="message-subject">${escapeHtml(subject)}</div>
            <div class="message-from">${escapeHtml(from)}</div>
            <div class="toggle-icon">${isLatest ? '▼' : '▶'}</div>
          </div>
          <div class="message-body" style="display: ${isLatest ? 'block' : 'none'}">
            ${bodyWithLinks.replace(/\n/g, '<br>')}
          </div>
        </div>
      `;
        });

        html += '</div>';
        messageDisplay.innerHTML = html;

        // Add click handlers using event delegation
        const messagesList = messageDisplay.querySelector('.messages-list');
        if (messagesList) {
            messagesList.addEventListener('click', (e) => {
                const header = e.target.closest('.message-header');
                if (header) {
                    const messageItem = header.closest('.message-item');
                    const body = messageItem.querySelector('.message-body');
                    const icon = messageItem.querySelector('.toggle-icon');

                    if (messageItem.classList.contains('expanded')) {
                        messageItem.classList.remove('expanded');
                        messageItem.classList.add('collapsed');
                        body.style.display = 'none';
                        icon.textContent = '▶';
                    } else {
                        messageItem.classList.remove('collapsed');
                        messageItem.classList.add('expanded');
                        body.style.display = 'block';
                        icon.textContent = '▼';
                    }
                }
            });
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function linkifyText(text) {
        // Escape HTML first but keep URLs as placeholders
        let processed = '';
        let lastIndex = 0;

        // Find all URLs
        const urlRegex = /<?(https?:\/\/[^\s<>]+)>?/g;
        let match;

        while ((match = urlRegex.exec(text)) !== null) {
            // Add text before URL (escaped)
            processed += escapeHtml(text.substring(lastIndex, match.index));

            // Clean URL - remove trailing punctuation
            let url = match[1].replace(/[.,;:)\]}\n]+$/, '');

            // Add clickable link
            processed += `<a href="${url}" target="_blank" class="message-link">${escapeHtml(url)}</a>`;

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text (escaped)
        processed += escapeHtml(text.substring(lastIndex));

        return processed;
    }
});
