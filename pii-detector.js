/**
 * pii-detector.js - Lightweight, local, regex-based PII detection and redaction
 * Milestone 2: Demonstrable on-device prototype for SIH26171.
 *
 * Runs purely in-memory on the client machine; no external network requests.
 */

// 1. Password detection heuristic: identifies values following password/pwd keywords
const PASSWORD_REGEX = /\b((?:password|pwd|passcode|secret)[\s:=]+(?:is[\s:=]*)?)([^\s\r\n,;!]+)/gi;

// 2. Credit card number detection: 13-16 digit sequences with optional dashes or spaces
const CREDIT_CARD_REGEX = /\b(?:\d{4}[ -]?){3}\d{1,4}\b|\b\d{13,16}\b/g;

// 3. Phone number detection: 10-digit numbers, standard hyphen/bracket notation, and international prefixes
const PHONE_REGEX = /(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b|\b\d{10}\b/g;

// 4. Email address detection: standard email formats (username@domain.tld)
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/**
 * Scans a string and replaces sensitive personal information with masked placeholders.
 * Order of operations matters: passwords and credit cards are processed before generic numbers.
 *
 * @param {string} text - Raw input text from the webpage
 * @returns {string} - Cleaned text with detected PII redacted
 */
function redactText(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  let redacted = text;

  // Mask Passwords (preserves prefix like "password: " and replaces the value)
  redacted = redacted.replace(PASSWORD_REGEX, "$1[REDACTED_PASSWORD]");

  // Mask Credit Card Numbers
  redacted = redacted.replace(CREDIT_CARD_REGEX, "[REDACTED_CARD]");

  // Mask Phone Numbers
  redacted = redacted.replace(PHONE_REGEX, "[REDACTED_PHONE]");

  // Mask Emails
  redacted = redacted.replace(EMAIL_REGEX, "[REDACTED_EMAIL]");

  return redacted;
}

// Expose redactText to content scripts in the extension's execution context
if (typeof window !== "undefined") {
  window.redactText = redactText;
}
