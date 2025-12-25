import { intervalToDuration } from 'date-fns';

export const formatUptime = (secondsStr: string | number): string => {
    const seconds = typeof secondsStr === 'string' ? parseInt(secondsStr, 10) : secondsStr;

    if (isNaN(seconds)) return 'N/A';
    if (seconds < 60) return `${seconds}s`;

    const duration = intervalToDuration({ start: 0, end: seconds * 1000 });

    if (duration.days && duration.days > 0) {
        return `${duration.days}d ${duration.hours ?? 0}h ${duration.minutes ?? 0}m`;
    }
    if (duration.hours && duration.hours > 0) {
        return `${duration.hours}h ${duration.minutes ?? 0}m`;
    }
    return `${duration.minutes ?? 0}m ${duration.seconds ?? 0}s`;
};
