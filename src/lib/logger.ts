import client from "@/lib/mongodb";
import fs from "fs";
import path from "path";

export type AuditLogAction = 
  | "USER_REGISTERED" 
  | "PASSWORD_RESET_REQUESTED" 
  | "PASSWORD_RESET_COMPLETED" 
  | "STORE_CREATED" 
  | "BUSINESS_DETAILS_UPDATED" 
  | "SUBSCRIPTION_ACTIVATED"
  | "PRODUCT_UPDATED"
  | "STAFF_USER_CREATED"
  | "ERROR";

interface LogEntry {
  action: AuditLogAction;
  userId?: string;
  tenantId?: string;
  details?: Record<string, any>;
  timestamp?: Date;
}

const LOGS_DIR = path.join(process.cwd(), "logs");

const SENSITIVE_KEYS = ["password", "token", "phonenumber", "card", "creditcard", "cvv", "ssn", "secret"];

function redactSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    // Optional: add regex-based redaction for strings if they contain emails, but 
    // for now we'll rely on key-based redaction for structured data.
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item));
  }
  
  if (typeof obj === 'object') {
    const redacted: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEYS.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
          redacted[key] = "[REDACTED]";
        } else if (lowerKey === "email") {
          // Keep the domain for debugging, but redact the local part if needed, or fully redact.
          // Fully redacting email as requested in audit: "remove user emails"
          redacted[key] = "[REDACTED]";
        } else {
          redacted[key] = redactSensitiveData(obj[key]);
        }
      }
    }
    return redacted;
  }
  
  return obj;
}

async function writeToLocalFile(logData: any) {
  try {
    // Ensure logs directory exists
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    const logFilePath = path.join(LOGS_DIR, "app.log");
    const logString = JSON.stringify(logData) + "\n";
    await fs.promises.appendFile(logFilePath, logString, "utf8");
  } catch (error) {
    console.error("Failed to write to local log file:", error);
  }
}

export async function logAction(entry: LogEntry) {
  const logData = {
    ...entry,
    details: redactSensitiveData(entry.details),
    timestamp: new Date(),
  };

  // 1. Output to Console for immediate feedback
  console.log(`[AUDIT] ${logData.action}`, logData.details || "");

  // 2. Write to Local File
  await writeToLocalFile(logData);

  // 3. Write to MongoDB `logs` collection
  try {
    const db = client.db("pos");
    await db.collection("logs").insertOne(logData);
  } catch (error) {
    console.error("Failed to write log to MongoDB:", error);
  }
}

export async function logError(error: unknown, context?: Record<string, any>) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  
  await logAction({
    action: "ERROR",
    details: {
      message: errorMessage,
      stack,
      ...context
    }
  });
}
