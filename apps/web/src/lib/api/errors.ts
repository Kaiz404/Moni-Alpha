import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function handleApiError(error: unknown) {
  console.error('API error:', error);
  
  // Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation error',
        details: error.errors,
      },
      { status: 400 }
    );
  }
  
  // Database errors
  if (error instanceof Error) {
    if (error.message.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'A record with this value already exists' },
        { status: 409 }
      );
    }
    
    if (error.message.includes('foreign key constraint')) {
      return NextResponse.json(
        { error: 'Referenced record does not exist' },
        { status: 400 }
      );
    }
    
    if (error.message.includes('violates check constraint')) {
      return NextResponse.json(
        { error: 'Invalid data: constraint violation' },
        { status: 400 }
      );
    }
    
    // Generic error
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
  
  return NextResponse.json(
    { error: 'An unexpected error occurred' },
    { status: 500 }
  );
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
