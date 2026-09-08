/**
 * form-profile.js — Client-Side Local Form Profile & Simultaneous Autofill Manager
 * SIH26171: On-device Visual Perception for Lightweight Browser Agents
 *
 * Stores user form data locally in-memory/JSON and provides intelligent fuzzy semantic
 * matching to map perceived page form fields to their corresponding profile values.
 *
 * Privacy Guarantees:
 * - Stored and resolved strictly client-side on-device.
 * - Never uploaded to external cloud endpoints or raw gateways.
 * - Fills all matched fields simultaneously in a single atomic pass.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SIHFormProfile = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Default Form Profile Details
  const DEFAULT_FORM_PROFILE = {
    fullName: "Sanketh Mallikarjuna",
    name: "Sanketh Mallikarjuna",
    firstName: "Sanketh",
    lastName: "Mallikarjuna",
    email: "sanketh@example.com",
    phone: "+1-555-0199",
    organization: "SIH Visual Perception Labs",
    company: "SIH Visual Perception Labs",
    address: "123 Innovation Way, Tech Park",
    street: "123 Innovation Way",
    city: "Bengaluru",
    state: "Karnataka",
    zip: "560001",
    postalCode: "560001",
    country: "India",
    comments: "Automated visual perception agent verification test.",
    message: "Automated visual perception agent verification test.",
    notes: "Automated visual perception agent verification test."
  };

  let activeProfile = Object.assign({}, DEFAULT_FORM_PROFILE);

  // Field Semantic Synonyms dictionary
  const FIELD_SYNONYMS = {
    fullName: [
      "full name", "fullname", "name", "your name", "applicant name",
      "student name", "candidate name", "user name", "username", "first and last name"
    ],
    firstName: ["first name", "firstname", "given name", "fname"],
    lastName: ["last name", "lastname", "surname", "family name", "lname"],
    email: [
      "email", "email address", "e-mail", "e-mail address", "your email",
      "contact email", "mail", "user email"
    ],
    phone: [
      "phone", "phone number", "mobile", "mobile number", "contact number",
      "telephone", "tel", "cell", "cell phone", "phone no"
    ],
    organization: [
      "organization", "organisation", "company", "company name",
      "institution", "workplace", "business name", "dept", "department"
    ],
    address: [
      "address", "street address", "home address", "residential address",
      "permanent address", "postal address", "mailing address", "street"
    ],
    city: ["city", "town", "city of residence", "municipality", "location"],
    state: ["state", "province", "region", "state / province"],
    zip: ["zip", "zip code", "postal code", "postcode", "pincode", "pin code"],
    country: ["country", "nation", "country of residence"],
    comments: [
      "comments", "comment", "message", "your message", "feedback",
      "notes", "description", "inquiry", "details", "questions or comments",
      "additional info", "additional information", "remarks"
    ]
  };

  /**
   * Normalizes a text string for matching.
   * @param {string} s
   * @returns {string}
   */
  function normalizeText(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[\*:#_\-\/\\]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Gets the currently active form profile.
   * @returns {Object}
   */
  function getFormProfile() {
    return Object.assign({}, activeProfile);
  }

  /**
   * Sets or updates custom profile values.
   * @param {Object} customProfile
   */
  function setFormProfile(customProfile) {
    if (customProfile && typeof customProfile === "object") {
      activeProfile = Object.assign({}, activeProfile, customProfile);
    }
  }

  /**
   * Resets active profile to defaults.
   */
  function resetFormProfile() {
    activeProfile = Object.assign({}, DEFAULT_FORM_PROFILE);
  }

  /**
   * Matches a single UI field descriptor to the best matching profile field.
   *
   * @param {Object} field - { label, name, id, placeholder, ariaLabel, type }
   * @param {Object} [profile] - Optional custom profile object
   * @returns {Object|null} - { key, value, score, matchedSynonym } or null
   */
  function matchFieldToProfile(field, profile) {
    if (!field || typeof field !== "object") return null;

    const prof = profile || activeProfile;

    // Collect all identifying strings for this field
    const candidates = [
      normalizeText(field.label),
      normalizeText(field.placeholder),
      normalizeText(field.name),
      normalizeText(field.id),
      normalizeText(field.ariaLabel),
      normalizeText(field.title)
    ].filter(Boolean);

    if (candidates.length === 0) return null;

    let bestMatch = null;
    let highestScore = 0;

    for (const [key, synonyms] of Object.entries(FIELD_SYNONYMS)) {
      if (!prof[key]) continue;

      for (const text of candidates) {
        for (const syn of synonyms) {
          let score = 0;
          if (text === syn) {
            score = 1.0;
          } else if (text.startsWith(syn) || syn.startsWith(text)) {
            score = 0.9;
          } else if (text.includes(syn) || syn.includes(text)) {
            score = 0.8;
          }

          if (score > highestScore) {
            highestScore = score;
            bestMatch = {
              key: key,
              value: prof[key],
              score: score,
              matchedSynonym: syn
            };
          }
        }
      }
    }

    if (highestScore >= 0.7 && bestMatch) {
      return bestMatch;
    }

    return null;
  }

  /**
   * Evaluates all visible visual elements and creates a simultaneous fill plan.
   *
   * @param {Array<Object>} visualElements
   * @param {Object} [profile]
   * @returns {Array<Object>} Array of field matches to fill simultaneously
   */
  function getSimultaneousFormFillPlan(visualElements, profile) {
    if (!Array.isArray(visualElements)) return [];

    const prof = profile || activeProfile;
    const plan = [];
    const FORM_TYPES = new Set(["input", "textarea", "select", "textbox"]);

    visualElements.forEach((el, idx) => {
      const type = (el.type || "").toLowerCase();
      if (!FORM_TYPES.has(type)) return;

      // Skip disabled or password fields
      if (el.disabled || String(el["aria-disabled"]).toLowerCase() === "true") return;
      if (el.inputType === "password" || el.isPassword || /password/i.test(el.label || el.name || "")) return;

      const matched = matchFieldToProfile(el, prof);
      if (matched && matched.value) {
        plan.push({
          targetIndex: el.index !== undefined ? el.index : idx,
          targetType: el.type || "input",
          targetLabel: el.label || el.name || el.placeholder || `Field #${idx}`,
          fieldKey: matched.key,
          value: matched.value,
          score: matched.score
        });
      }
    });

    return plan;
  }

  return {
    DEFAULT_FORM_PROFILE,
    FIELD_SYNONYMS,
    getFormProfile,
    setFormProfile,
    resetFormProfile,
    matchFieldToProfile,
    getSimultaneousFormFillPlan,
    normalizeText
  };
});
