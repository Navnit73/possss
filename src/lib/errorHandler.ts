import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logError } from "./logger";

export async function handleApiError(error: any, endpoint: string) {
  // Log the error internally
  await logError(error, { endpoint });
  
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

  // Generic fallback with the actual error message
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ 
    error: `An error occurred: ${message}` 
  }, { status: 500 });
}
