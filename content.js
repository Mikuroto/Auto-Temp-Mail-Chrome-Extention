// Content script for Auto Temp Mail

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fillEmail') {
        fillInput(request.email, ['email', 'e-mail', 'mail']);
    } else if (request.action === 'fillCode') {
        fillInput(request.code, ['code', 'verification', 'otp', 'pin']);
    }
});

function fillInput(value, keywords) {
    const inputs = document.querySelectorAll('input');

    for (const input of inputs) {
        // Check if input is visible
        if (input.type === 'hidden' || input.style.display === 'none') continue;

        const name = (input.name || '').toLowerCase();
        const id = (input.id || '').toLowerCase();
        const placeholder = (input.placeholder || '').toLowerCase();
        const type = (input.type || '').toLowerCase();
        const label = getLabelForInput(input);

        // Check if any keyword matches
        const isMatch = keywords.some(keyword =>
            name.includes(keyword) ||
            id.includes(keyword) ||
            placeholder.includes(keyword) ||
            label.includes(keyword) ||
            (type === 'email' && keywords.includes('email'))
        );

        if (isMatch) {
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));

            // Highlight the field briefly
            const originalBorder = input.style.border;
            input.style.border = '2px solid #27ae60';
            setTimeout(() => {
                input.style.border = originalBorder;
            }, 1000);

            // Focus the input
            input.focus();

            // Stop after first match (usually correct)
            // But for code inputs, sometimes there are multiple boxes (e.g. 6 boxes for 6 digits).
            // This simple logic handles single input fields. 
            // Handling multi-box inputs is much more complex and might require specific site logic.
            break;
        }
    }
}

function getLabelForInput(input) {
    let labelText = '';

    // 1. Check for label tag with 'for' attribute
    if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) labelText += label.innerText;
    }

    // 2. Check for parent label tag
    const parentLabel = input.closest('label');
    if (parentLabel) labelText += parentLabel.innerText;

    // 3. Check aria-label
    if (input.getAttribute('aria-label')) {
        labelText += input.getAttribute('aria-label');
    }

    return labelText.toLowerCase();
}
