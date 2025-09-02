import { json } from '@sveltejs/kit';
import { z } from 'zod';

/**
 * Handles API errors with consistent logging and response format
 */
export function handleApiError(error: unknown, defaultMessage: string, status: number = 500) {
    if (error instanceof Response) {
        throw error;
    }
    
    if (error instanceof z.ZodError) {
        console.error(`${defaultMessage} - Validation Error:`, error.errors);
        return json(
            { 
                success: false, 
                error: 'Invalid input', 
                details: error.errors 
            },
            { status: 400 }
        );
    }
    
    // Log the full error for debugging
    console.error(`${defaultMessage}:`, error);
    
    return json(
        { 
            success: false, 
            error: defaultMessage,
            details: error instanceof Error ? error.message : String(error)
        },
        { status }
    );
}