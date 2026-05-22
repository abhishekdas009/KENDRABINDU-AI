// ============================================================
// JobMailer — Google Apps Script
// File: apps-script/Code.gs
// Handles: Gmail sending, reply polling, webhook to FastAPI
// ============================================================

const CONFIG = {
  LOCAL_SERVER: "https://YOUR_NGROK_URL",  // ← Replace after ngrok starts
  REPLY_CHECK_LABEL: "JobMailer",
  TRACK_QUERY: 'subject:"Application for" newer_than:180d',
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

    const subject = `Application for ${position} — Abhishek Das`;
    const htmlBody = buildEmailHTML(hrName, company, position, coverLetter);
    const plainBody = buildEmailPlain(hrName, company, position, coverLetter);

    // Send email with resume as text attachment
    GmailApp.sendEmail(to, subject, plainBody, {
      name: CONFIG.SENDER_NAME,
      htmlBody: htmlBody,
      attachments: [
        Utilities.newBlob(
          resume,
          "text/plain",
          `Abhishek_Das_${position.replace(/ /g, "_")}_Resume.txt`
        ),
      ],
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
function buildEmailHTML(hrName, company, position, coverLetter) {
  const formattedCL = coverLetter.replace(/\n/g, "<br>");
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="
  font-family: 'Segoe UI', Arial, sans-serif;
  max-width: 650px;
  margin: 0 auto;
  background: #ffffff;
  color: #1a1a1a;
  padding: 32px 24px;
">

  <!-- Header Bar -->
  <div style="
    background: linear-gradient(135deg, #1d4ed8, #2563eb);
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 28px;
  ">
    <h2 style="margin:0; color:#ffffff; font-size:18px;">
      Application: ${position}
    </h2>
    <p style="margin:4px 0 0; color:#bfdbfe; font-size:13px;">
      Abhishek Das — Data Engineer, Delhi, India
    </p>
  </div>

  <!-- Cover Letter Body -->
  <div style="
    border-left: 4px solid #2563eb;
    padding-left: 20px;
    margin-bottom: 28px;
    line-height: 1.8;
    font-size: 15px;
    color: #374151;
  ">
    ${formattedCL}
  </div>

  <!-- Footer -->
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin-bottom: 16px;">
  <p style="font-size: 12px; color: #9ca3af; margin: 0;">
    📎 Resume attached as .txt file<br>
    <strong style="color:#6b7280;">Abhishek Das</strong> |
    Data Engineer | Delhi, India
  </p>

</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// Plain Text Fallback
// ─────────────────────────────────────────────────────────────
function buildEmailPlain(hrName, company, position, coverLetter) {
  return `${coverLetter}

---
Abhishek Das | Data Engineer | Delhi, India
(Resume attached as .txt file)`;
}
