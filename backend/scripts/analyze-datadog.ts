import { fetch } from 'undici';

const DD_API_KEY = '928bdd53125840a03e6b1f6436d27e16';
const DD_APP_KEY = 'dde1cc37a8df7f37476d32147d3cb38f6740e558';

const SITE = 'https://api.datadoghq.com';

async function queryPerformance() {
    console.log('📊 Querying Datadog RUM Performance (Last 1 Hour)...');

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Query for RUM View events
    const query = {
        filter: {
            query: "source:browser type:view",
            from: oneHourAgo.toISOString(),
            to: now.toISOString(),
        },
        page: {
            limit: 50
        }
    };

    try {
        const response = await fetch(`${SITE}/api/v2/rum/events/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'DD-API-KEY': DD_API_KEY,
                'DD-APPLICATION-KEY': DD_APP_KEY
            },
            body: JSON.stringify(query)
        });

        if (!response.ok) {
            console.log(`⚠️ RUM endpoint returned ${response.status}. Falling back to Logs search...`);
            return await queryLogsFallback();
        }

        const data = await response.json() as any;
        console.log(`\nFound ${data.meta?.page?.total_count || 0} RUM View events.`);

        if (data.data && data.data.length > 0) {
            let totalLoadTime = 0;
            let count = 0;

            console.log('\n🚀 Page Load Performance:');
            data.data.forEach((event: any) => {
                const attrs = event.attributes;
                const viewName = attrs.view?.name || attrs.view?.url_path || 'Unknown View';
                // view.loading_time is in nanoseconds
                const timeNs = attrs.view?.loading_time;

                if (timeNs) {
                    const ms = timeNs / 1000000;
                    console.log(`- ${viewName}: ${ms.toFixed(2)}ms`);
                    totalLoadTime += ms;
                    count++;
                }
            });

            if (count > 0) {
                console.log(`\n⚡ Average Load Time: ${(totalLoadTime / count).toFixed(2)}ms`);
            }
        } else {
            console.log('\nℹ️ No RUM events found yet. The site might need traffic.');
            await queryLogsFallback(); // Check logs anyway to be sure
        }

    } catch (error) {
        console.error('Failed to query Datadog Performance:', error);
        await queryLogsFallback();
    }
}

async function queryLogsFallback() {
    console.log('\n🔍 Checking Backend Logs (Fallback)...');
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const query = {
        filter: {
            query: "source:standoff-backend",
            from: oneHourAgo.toISOString(),
            to: now.toISOString(),
        },
        page: { limit: 10 }
    };

    try {
        const response = await fetch(`${SITE}/api/v2/logs/events/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'DD-API-KEY': DD_API_KEY,
                'DD-APPLICATION-KEY': DD_APP_KEY
            },
            body: JSON.stringify(query)
        });

        if (response.ok) {
            const data = await response.json() as any;
            console.log(`Found ${data.meta?.page?.total_count || 0} backend logs.`);
        }
    } catch (e) {
        console.error("Log query also failed:", e);
    }
}

queryPerformance();
