export const logToDatadog = async (
    apiKey: string,
    message: string,
    level: 'info' | 'warn' | 'error' = 'info',
    meta: Record<string, any> = {}
) => {
    if (!apiKey) return;

    const logEntry = {
        ddsource: 'standoff-backend',
        ddtags: 'env:production,service:standoff-backend',
        message,
        status: level,
        timestamp: new Date().toISOString(),
        dd: {
            trace_id: meta.trace_id,
            span_id: meta.span_id
        },
        ...meta
    };

    try {
        await fetch('https://http-intake.logs.datadoghq.com/api/v2/logs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'DD-API-KEY': apiKey
            },
            body: JSON.stringify(logEntry)
        });
    } catch (e) {
        // Fail silently to avoid infinite loops if logging fails
        console.error('Failed to send log to Datadog:', e);
    }
};
