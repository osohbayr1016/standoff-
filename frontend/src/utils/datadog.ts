import { datadogRum } from '@datadog/browser-rum';
import { reactPlugin } from '@datadog/browser-rum-react';

export const initDatadog = () => {
    // Only init if credentials exist
    if (!import.meta.env.VITE_DATADOG_APP_ID || !import.meta.env.VITE_DATADOG_CLIENT_TOKEN) {
        console.warn('Datadog credentials not found, skipping initialization');
        return;
    }

    datadogRum.init({
        applicationId: import.meta.env.VITE_DATADOG_APP_ID,
        clientToken: import.meta.env.VITE_DATADOG_CLIENT_TOKEN,
        site: 'datadoghq.com',
        service: 'standoff2-frontend',
        env: import.meta.env.MODE || 'production',
        // version: '1.0.0', 
        sessionSampleRate: 100,
        sessionReplaySampleRate: 20,
        trackUserInteractions: true,
        trackResources: true,
        trackLongTasks: true,
        defaultPrivacyLevel: 'mask-user-input',
        // @ts-ignore
        allowedTracingOrigins: [
            'http://localhost:8788',
            'https://backend.anandoctane4.workers.dev',
            /https:\/\/.*\.standoff-backend\.pages\.dev/,
            'https://standoff2.mn'
        ],
        plugins: [
            reactPlugin({
                router: true
            })
        ],
    });

    datadogRum.startSessionReplayRecording();
};
