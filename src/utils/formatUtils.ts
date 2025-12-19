export const formatUptime = (secondsStr: string | number): string => {
    const seconds = typeof secondsStr === 'string' ? parseInt(secondsStr, 10) : secondsStr;

    if (isNaN(seconds)) return 'N/A';
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ${hours % 24}h ${minutes % 60}m`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m ${seconds % 60}s`;
};
