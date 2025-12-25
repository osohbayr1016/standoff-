
/**
 * Test script to simulate a NeatQueue MATCH_STARTED webhook
 * Run with: npx tsx scripts/test-webhook.ts
 */

const WEBHOOK_URL = 'https://backend.anandoctane4.workers.dev/api/neatqueue/webhook';
// Use the deployed secret
const WEBHOOK_SECRET = 'CMMvOiC5EiecsaKPldUf11N4HsyIZsE0';

async function sendTestWebhook() {
    console.log(`Sending webhook to: ${WEBHOOK_URL}`);

    const payload = {
        action: "MATCH_STARTED",
        guild_id: "1452635831901753357",
        channel_id: "1453526990798983394",
        queue_name: "Faceit-Level-10",
        game_number: 12345,
        map: "Sandstone",
        lobby_details: "Server: 1.2.3.4:27015 | Password: secret_pass",
        teams: [
            {
                name: "Team Alpha",
                players: [
                    { id: "player1_discord_id", name: "PlayerOne", rating: 1200 },
                    { id: "player2_discord_id", name: "PlayerTwo", rating: 1150 },
                    { id: "player3_discord_id", name: "PlayerThree", rating: 1180 },
                    { id: "player4_discord_id", name: "PlayerFour", rating: 1210 },
                    { id: "player5_discord_id", name: "PlayerFive", rating: 1190 }
                ]
            },
            {
                name: "Team Bravo",
                players: [
                    { id: "player6_discord_id", name: "PlayerSix", rating: 1205 },
                    { id: "player7_discord_id", name: "PlayerSeven", rating: 1160 },
                    { id: "player8_discord_id", name: "PlayerEight", rating: 1175 },
                    { id: "player9_discord_id", name: "PlayerNine", rating: 1220 },
                    { id: "player10_discord_id", name: "PlayerTen", rating: 1195 }
                ]
            }
        ]
    };

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WEBHOOK_SECRET}`
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();

        console.log(`Response Status: ${response.status}`);
        console.log(`Response Body: ${responseText}`);

        if (response.ok) {
            console.log("✅ Webhook sent successfully!");
            console.log("Check the frontend - it should have navigated to the Match Lobby.");
        } else {
            console.error("❌ Failed to send webhook.");
        }

    } catch (error) {
        console.error("Error sending webhook:", error);
    }
}

sendTestWebhook();
