/**
 * RPC utility functions for handling blockchain interactions
 */

/**
 * Execute a function with a timeout
 * @param fn The function to execute
 * @param timeoutMs Timeout in milliseconds
 * @returns Promise that resolves with the function result or rejects on timeout
 */
export async function withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number = 30000 // 30 seconds default
): Promise<T> {
    return Promise.race([
        fn(),
        new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        })
    ]);
}

/**
 * Retry a function with exponential backoff
 * @param fn The function to retry
 * @param maxRetries Maximum number of retries
 * @param baseDelayMs Base delay between retries in milliseconds
 * @returns Promise that resolves with the function result
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            
            if (attempt === maxRetries) {
                throw lastError;
            }
            
            // Exponential backoff
            const delay = baseDelayMs * Math.pow(2, attempt);
            console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, lastError.message);
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError!;
}

/**
 * Execute a function with both timeout and retry logic
 * @param fn The function to execute
 * @param options Configuration options
 * @returns Promise that resolves with the function result
 */
export async function withTimeoutAndRetry<T>(
    fn: () => Promise<T>,
    options: {
        timeoutMs?: number;
        maxRetries?: number;
        baseDelayMs?: number;
    } = {}
): Promise<T> {
    const { timeoutMs = 30000, maxRetries = 3, baseDelayMs = 1000 } = options;
    
    return withRetry(
        () => withTimeout(fn, timeoutMs),
        maxRetries,
        baseDelayMs
    );
} 