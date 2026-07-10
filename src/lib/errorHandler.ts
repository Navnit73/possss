import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logError } from "./logger";
import crypto from "crypto";

export async function handleApiError(error: any, endpoint: string) {
  const correlationId = crypto.randomUUID();

  // Log the error internally with the correlation ID
  await logError(error, { endpoint, correlationId });
  
  // Format Zod validation errors into a human-readable string
  if (error instanceof ZodError) {
    const explainedError = error.issues.map(e => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    }).join(', ');
    
    return NextResponse.json({ 
      error: `Validation failed: ${explainedError}` 
    }, { status: 400 });
  }

  // Handle MongoDB duplicate key errors (e.g. unique indexes)
  if (error.code === 11000) {
    return NextResponse.json({ 
      error: "This record already exists. Please use different information." 
    }, { status: 409 });
  }

  // Generic fallback: Do not leak error details to the client
  return NextResponse.json({ 
    error: "An unexpected internal error occurred.",
    correlationId 
  }, { status: 500 });
}
