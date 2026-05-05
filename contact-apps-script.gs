const RECIPIENT_EMAIL = "sbt4183@gmail.com";
const MAX_FIELD_LENGTH = 4000;

const TAB_BY_FORM_TYPE = {
  enquiry: "Enquiries",
  meeting_request: "Meeting Requests",
  feedback: "Feedback",
};

const FIELD_ORDER_BY_FORM_TYPE = {
  enquiry: ["form_type", "name", "reply_to", "topic", "message"],
  meeting_request: [
    "form_type",
    "name",
    "reply_to",
    "preferred_date",
    "preferred_time",
    "meeting_type",
    "meeting_format",
    "message",
  ],
  feedback: [
    "form_type",
    "feedback_subject",
    "service_area",
    "usefulness",
    "clearer_afterwards",
    "could_be_smoother",
    "quote_permission",
    "name_contact",
  ],
};

function doPost(event) {
  try {
    return handlePost(event);
  } catch (error) {
    return htmlResponse(
      "Something did not send",
      "Please go back, check the required fields, and try again. If it still fails, contact Strange but True directly."
    );
  }
}

function handlePost(event) {
  const data = event && event.parameter ? event.parameter : {};

  if ((data.website || "").trim()) {
    return htmlResponse("Thanks", "Your note has been received.");
  }

  const formType = normaliseFormType(data.form_type);
  const sheetName = TAB_BY_FORM_TYPE[formType];
  const fieldOrder = FIELD_ORDER_BY_FORM_TYPE[formType];

  const cleaned = cleanData(data, fieldOrder);
  validateRequiredFields(formType, cleaned);

  const sheet = getOrCreateSheet(sheetName, fieldOrder);
  sheet.appendRow([new Date()].concat(fieldOrder.map((field) => cleaned[field] || "")));

  const emailOptions = {
    to: RECIPIENT_EMAIL,
    subject: `Strange but True ${formatFieldName(formType)}`,
    body: buildEmailBody(formType, cleaned, fieldOrder),
  };

  const replyTo = cleaned.reply_to || cleaned.name_contact;
  if (replyTo) {
    emailOptions.replyTo = replyTo;
  }

  MailApp.sendEmail(emailOptions);

  return htmlResponse("Thanks", "Your message has been sent to Strange but True.");
}

function normaliseFormType(formType) {
  const value = (formType || "").trim();
  if (!TAB_BY_FORM_TYPE[value]) {
    throw new Error("Unknown form type.");
  }
  return value;
}

function cleanData(data, fieldOrder) {
  const cleaned = {};

  fieldOrder.forEach((field) => {
    const value = (data[field] || "").trim();
    cleaned[field] = value.slice(0, MAX_FIELD_LENGTH);
  });

  return cleaned;
}

function validateRequiredFields(formType, data) {
  if (formType === "meeting_request") {
    requireFields(data, ["name", "reply_to", "preferred_date", "preferred_time"]);
  }

  if (formType === "feedback") {
    requireFields(data, ["service_area", "usefulness"]);
  }
}

function requireFields(data, fields) {
  fields.forEach((field) => {
    if (!data[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  });
}

function getOrCreateSheet(sheetName, fieldOrder) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["received_at"].concat(fieldOrder));
  }

  return sheet;
}

function buildEmailBody(formType, data, fieldOrder) {
  const lines = fieldOrder.map((field) => `${formatFieldName(field)}: ${data[field] || ""}`);

  return [
    `New Strange but True ${formatFieldName(formType)} submission.`,
    "",
    ...lines,
    "",
    "Reply manually before confirming any booking or delivery detail.",
  ].join("\n");
}

function formatFieldName(name) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function htmlResponse(title, message) {
  const html = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title} | Strange but True</title>`,
    "</head>",
    '<body style="font-family: Arial, sans-serif; margin: 2rem; line-height: 1.5;">',
    `<h1>${title}</h1>`,
    `<p>${message}</p>`,
    '<p><a href="https://auraofintelligence.github.io/strange-but-true/contact.html">Back to Strange but True</a></p>',
    "</body>",
    "</html>",
  ].join("");

  return HtmlService.createHtmlOutput(html);
}
