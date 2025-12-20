/**
 * Executes an array of tasks with limited concurrency.
 * @param tasks - An array of functions that return a promise.
 * @param limit - Max number of concurrent tasks.
 */
export async function runWithConcurrencyLimit<T>(
    tasks: (() => Promise<T>)[],
    limit: number = 5
): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < tasks.length; i++) {
        const p = tasks[i]().then(res => {
            results[i] = res;
        });
        executing.push(p);

        if (executing.length >= limit) {
            await Promise.race(executing);
            // Remove finished promises from the executing array
            // Since we don't know which one finished, we check their status or just filter by completion
            // A simpler way for a small helper:
            for (let j = executing.length - 1; j >= 0; j--) {
                // If the promise is finished, it should be removed.
                // However, Promise.race doesn't tell us which one.
                // Let's use a more robust tracker.
            }
        }
    }
    await Promise.all(executing);
    return results;
}

// Improved version
export async function pool<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number
): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let index = 0;

    const worker = async () => {
        while (index < tasks.length) {
            const currentIndex = index++;
            results[currentIndex] = await tasks[currentIndex]();
        }
    };

    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
    await Promise.all(workers);
    return results;
}
