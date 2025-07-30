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

/**
 * Handle transaction receipt errors gracefully
 * This function specifically handles RPC errors that can cause service crashes
 * @param transaction The transaction object
 * @param options Configuration options
 * @returns Promise that resolves with transaction receipt or null if failed
 */
export async function waitForTransactionReceipt(
    transaction: any,
    options: {
        timeoutMs?: number;
        maxRetries?: number;
        baseDelayMs?: number;
        maxBlocksToWait?: number;
    } = {}
): Promise<any> {
    const { 
        timeoutMs = 120000, // 2 minutes default
        maxRetries = 3, 
        baseDelayMs = 5000,
        maxBlocksToWait = 50 // Wait for up to 50 blocks
    } = options;

    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Try to get the receipt with a reasonable timeout
            const receipt = await withTimeout(
                () => transaction.wait(maxBlocksToWait),
                timeoutMs
            );
            
            return receipt;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            
            // Check if this is a specific RPC error that we should handle gracefully
            const errorMessage = lastError.message;
            const isRpcError = errorMessage.includes('UNKNOWN_ERROR') || 
                              errorMessage.includes('Unable to perform request') ||
                              errorMessage.includes('could not coalesce error') ||
                              errorMessage.includes('code": 19') ||
                              errorMessage.includes('eth_getTransactionReceipt');
            
            if (isRpcError) {
                console.warn(`RPC error on attempt ${attempt + 1}/${maxRetries + 1}:`, {
                    error: errorMessage,
                    transactionHash: transaction.hash,
                    attempt: attempt + 1
                });
                
                // For RPC errors, we might want to continue without the receipt
                // since the transaction might still be successful
                if (attempt === maxRetries) {
                    console.warn(`Max retries reached for transaction receipt. Transaction ${transaction.hash} may still be successful.`);
                    return null; // Return null instead of throwing
                }
            } else {
                // For non-RPC errors, throw immediately
                throw lastError;
            }
            
            // Exponential backoff for retries
            if (attempt < maxRetries) {
                const delay = baseDelayMs * Math.pow(2, attempt);
                console.log(`Retrying transaction receipt in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // If we get here, we've exhausted all retries for RPC errors
    console.warn(`Failed to get transaction receipt after ${maxRetries + 1} attempts. Transaction ${transaction.hash} may still be successful.`);
    return null;
} 