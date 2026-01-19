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
            
            let bodyContent = '';
            
            // Prefer HTML body if available, otherwise use text
            if (htmlBody) {
                // Sanitize and render HTML
                bodyContent = sanitizeHtml(htmlBody);
            } else if (textBody) {
                // For plain text, escape and linkify
                let body = textBody.replace(/\n{3,}/g, '\n\n');
                bodyContent = linkifyText(body).replace(/\n/g, '<br>');
            } else {
                bodyContent = '<span class="no-content">No content</span>';
            }

            html += `
        <div class="message-item ${isLatest ? 'expanded' : 'collapsed'}" data-index="${index}">
          <div class="message-header">
            <div class="message-subject">${escapeHtml(subject)}</div>
            <div class="message-from">${escapeHtml(from)}</div>
            <div class="toggle-icon">${isLatest ? '▼' : '▶'}</div>
          </div>
          <div class="message-body html-content" style="display: ${isLatest ? 'block' : 'none'}">
            ${bodyContent}
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

    function sanitizeHtml(html) {
        // Create a temporary element to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        // Remove dangerous elements
        const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed', 'form'];
        dangerousTags.forEach(tag => {
            const elements = temp.querySelectorAll(tag);
            elements.forEach(el => el.remove());
        });
        
        // Remove event handlers and dangerous attributes from all elements
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(el => {
            // Remove event handlers
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on') || attr.name === 'href' && attr.value.startsWith('javascript:')) {
                    el.removeAttribute(attr.name);
                }
            });
            
            // Make links open in new tab
            if (el.tagName === 'A' && el.hasAttribute('href')) {
                el.setAttribute('target', '_blank');
                el.setAttribute('rel', 'noopener noreferrer');
                el.classList.add('message-link');
            }
            
            // Remove inline styles that could break layout (keep colors and basic formatting)
            if (el.hasAttribute('style')) {
                const style = el.getAttribute('style');
                // Keep only safe styles
                const safeStyle = style.replace(/position\s*:/gi, '')
                                       .replace(/z-index\s*:/gi, '')
                                       .replace(/overflow\s*:/gi, '');
                el.setAttribute('style', safeStyle);
            }
        });
        
        return temp.innerHTML;
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
