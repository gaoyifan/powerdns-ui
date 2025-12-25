import pLimit from 'p-limit';

/**
 * Executes an array of tasks with limited concurrency using p-limit.
 * @param tasks - An array of functions that return a promise.
 * @param concurrency - Max number of concurrent tasks.
 * @param onProgress - Optional callback for progress updates.
 */
export async function pool<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number,
    onProgress?: (completed: number, total: number) => void
): Promise<T[]> {
    const limit = pLimit(concurrency);
    let completed = 0;
    const total = tasks.length;

    const wrappedTasks = tasks.map((task) =>
        limit(async () => {
            const result = await task();
            completed++;
            onProgress?.(completed, total);
            return result;
        })
    );

    return Promise.all(wrappedTasks);
}
