/**
 * Executes an array of tasks with limited concurrency.
 * @param tasks - An array of functions that return a promise.
 * @param concurrency - Max number of concurrent tasks.
 * @param onProgress - Optional callback for progress updates.
 */
export async function pool<T>(tasks: (() => Promise<T>)[], concurrency: number, onProgress?: (completed: number, total: number) => void): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let index = 0;
    let completed = 0;

    const worker = async () => {
        while (index < tasks.length) {
            const currentIndex = index++;
            results[currentIndex] = await tasks[currentIndex]();
            completed++;
            onProgress?.(completed, tasks.length);
        }
    };

    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
    await Promise.all(workers);
    return results;
}
