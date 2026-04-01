/**
 * Extract a readable error message from various error types
 * Handles Error instances, Supabase errors, and plain objects
 */
export function getErrorMessage(error: unknown): string {
  if (!error) {
    return 'Unknown error occurred';
  }

  // Handle Error instances
  if (error instanceof Error) {
    return error.message;
  }

  // Handle Supabase errors (they have a message property)
  if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof (error as any).message === 'string') {
      return (error as any).message;
    }
    if ('details' in error && typeof (error as any).details === 'string') {
      return (error as any).details;
    }
    if ('hint' in error && typeof (error as any).hint === 'string') {
      return (error as any).hint;
    }
  }

  // Fallback for other types
  return String(error);
}
