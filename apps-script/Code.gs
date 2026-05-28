// ============================================================
// KendraBindu AI — Google Apps Script
// File: apps-script/Code.gs
// Handles: Gmail sending, reply polling, webhook to FastAPI
// ============================================================

const CONFIG = {
  LOCAL_SERVER: "https://YOUR_NGROK_URL",  // ← Replace after ngrok starts
  REPLY_CHECK_LABEL: "KendraBindu AI",
  TRACK_QUERY: 'newer_than:180d (subject:application OR subject:profile OR subject:opportunity)',
  SENDER_NAME: "Abhishek Das",
  POLL_INTERVAL_MINUTES: 15,
};

// ─────────────────────────────────────────────────────────────
// doPost — Called by FastAPI /api/send to trigger Gmail send
// ─────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { to, hrName, company, position, resume, coverLetter, appId } = data;

    const subject = buildSubject(position, company);
    const htmlBody = buildEmailHTML(hrName, company, position, coverLetter);
    const plainBody = buildEmailPlain(hrName, company, position, coverLetter);
    const attachments = [];
    if (resume && String(resume).trim()) {
      attachments.push(Utilities.newBlob(resume, "text/plain", "Abhishek_Das_Resume.txt"));
    }

    GmailApp.sendEmail(to, subject, plainBody, {
      name: CONFIG.SENDER_NAME,
      htmlBody: htmlBody,
      attachments: attachments,
    });

    // Wait for Gmail to register the sent message
    Utilities.sleep(2500);

    // Find the sent thread to capture threadId
    const threads = GmailApp.search(`to:${to} subject:"${subject}"`, 0, 1);
    const threadId = threads.length > 0 ? threads[0].getId() : "";

    // Label the thread so pollReplies can track it
    let label = GmailApp.getUserLabelByName(CONFIG.REPLY_CHECK_LABEL);
    if (!label) label = GmailApp.createLabel(CONFIG.REPLY_CHECK_LABEL);
    if (threads.length > 0) threads[0].addLabel(label);

    Logger.log(`Email sent to ${to} | Thread: ${threadId}`);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, threadId: threadId }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("doPost Error: " + err.message);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─────────────────────────────────────────────────────────────
// pollReplies — Runs every 15 mins via time trigger
// Checks for HR replies and notifies FastAPI backend
// ─────────────────────────────────────────────────────────────
function pollReplies() {
  let label = GmailApp.getUserLabelByName(CONFIG.REPLY_CHECK_LABEL);
  if (!label) label = GmailApp.createLabel(CONFIG.REPLY_CHECK_LABEL);

  // SMTP sends still land in Gmail sent threads. Discover and label them so
  // reply polling works even when FastAPI sent the email directly.
  GmailApp.search(CONFIG.TRACK_QUERY, 0, 50).forEach(function(thread) {
    thread.addLabel(label);
  });

  const threads = label.getThreads(0, 50);
  const props = PropertiesService.getScriptProperties();

  threads.forEach(function(thread) {
    const messages = thread.getMessages();

    // Skip if no reply yet (only 1 message = just the sent email)
    if (messages.length < 2) return;

    const lastMsg = messages[messages.length - 1];
    const msgId = lastMsg.getId();

    // Skip already-processed messages
    if (props.getProperty("processed_" + msgId)) return;

    // Extract reply details
    const fromRaw = lastMsg.getFrom();
    const senderEmail = fromRaw.match(/<(.+)>/)
      ? fromRaw.match(/<(.+)>/)[1]
      : fromRaw.trim();

    const subject = lastMsg.getSubject();
    const body = lastMsg.getPlainBody().substring(0, 2000); // limit payload size
    const receivedAt = lastMsg.getDate().toISOString();

    Logger.log(`New reply from ${senderEmail} | Subject: ${subject}`);

    // Send webhook to FastAPI backend
    const payload = {
      hr_email: senderEmail,
      subject: subject,
      body: body,
      thread_id: thread.getId(),
      received_at: receivedAt,
    };

    try {
      const response = UrlFetchApp.fetch(
        CONFIG.LOCAL_SERVER + "/api/webhook/reply",
        {
          method: "POST",
          contentType: "application/json",
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        }
      );

      const responseCode = response.getResponseCode();
      Logger.log(`Webhook response: ${responseCode}`);

      if (responseCode === 200) {
        // Mark this message as processed so we don't re-send
        props.setProperty("processed_" + msgId, "true");
        Logger.log(`Marked ${msgId} as processed`);
      }

    } catch (err) {
      Logger.log("Webhook error: " + err.message);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// setupTrigger — Run this ONCE manually to install time trigger
// ─────────────────────────────────────────────────────────────
function setupTrigger() {
  // Remove all existing triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });

  // Create new time-based trigger for pollReplies
  ScriptApp.newTrigger("pollReplies")
    .timeBased()
    .everyMinutes(CONFIG.POLL_INTERVAL_MINUTES)
    .create();

  Logger.log(
    "✅ Trigger installed: pollReplies runs every " +
    CONFIG.POLL_INTERVAL_MINUTES + " minutes"
  );
}

// ─────────────────────────────────────────────────────────────
// Email HTML Template
// ─────────────────────────────────────────────────────────────
function buildSubject(position, company) {
  const role = String(position || "Open role").replace(/\s+/g, " ").trim();
  const org = String(company || "").replace(/\s+/g, " ").trim();
  return org
    ? `${role} application for ${org} - ${CONFIG.SENDER_NAME}`
    : `${role} application - ${CONFIG.SENDER_NAME}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildEmailHTML(hrName, company, position, coverLetter) {
  const greeting = hrName && hrName !== "Hiring Team" ? `Hi ${hrName},` : "Dear Hiring Team,";
  const paragraphs = String(coverLetter || "")
    .split(/\n{2,}/)
    .map(function(part) { return part.trim(); })
    .filter(Boolean)
    .map(function(part) {
      return `<p style="margin:0 0 14px">${escapeHtml(part)}</p>`;
    })
    .join("\n  ");
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="margin:0;background:#ffffff;color:#111111;font-family:Arial,sans-serif;font-size:14px;line-height:1.6">
  <div style="margin:0;text-align:left">
    <p style="margin:0 0 14px">${escapeHtml(greeting)}</p>
    ${paragraphs}
    <p style="margin:22px 0 0">Best regards,<br><strong>${escapeHtml(CONFIG.SENDER_NAME)}</strong></p>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// Plain Text Fallback
// ─────────────────────────────────────────────────────────────
function buildEmailPlain(hrName, company, position, coverLetter) {
  const greeting = hrName && hrName !== "Hiring Team" ? `Hi ${hrName},` : "Dear Hiring Team,";
  return `${greeting}

${coverLetter}

Best regards,
${CONFIG.SENDER_NAME}`;
}
