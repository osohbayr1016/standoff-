// Discord Tier Role IDs
export const TIERS = {
    GOLD: '1454095406446153839',   // 1600+
    SILVER: '1454150874531234065', // 1200+
    BRONZE: '1454150924556570624', // 1000+
    VIP: '1454234806933258382'
};

export async function updateDiscordRole(
    env: any,
    userId: string,
    roleId: string,
    add: boolean
): Promise<boolean> {
    const guildId = env.DISCORD_SERVER_ID;
    const botToken = env.DISCORD_BOT_TOKEN;

    if (!guildId || !botToken) {
        console.error('Discord config missing');
        return false;
    }

    try {
        const response = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`,
            {
                method: add ? 'PUT' : 'DELETE',
                headers: {
                    'Authorization': `Bot ${botToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok && response.status !== 204) {
            const errorText = await response.text();
            console.error(`Failed to ${add ? 'add' : 'remove'} Discord role:`, response.status, errorText);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Discord API error:', error);
        return false;
    }
}

export async function updateDiscordNickname(
    userId: string,
    nickname: string,
    botToken: string,
    guildId: string
): Promise<boolean> {
    try {
        const response = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bot ${botToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nick: nickname
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to update nickname on Discord:', response.status, errorText);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Discord API error:', error);
        return false;
    }
}


export async function sendDiscordMessage(
    env: any,
    channelId: string,
    content: string
): Promise<boolean> {
    const botToken = env.DISCORD_BOT_TOKEN;
    if (!botToken) {
        console.error('Discord bot token missing');
        return false;
    }

    try {
        const response = await fetch(
            `https://discord.com/api/v10/channels/${channelId}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bot ${botToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to send Discord message:', response.status, errorText);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Discord API error:', error);
        return false;
    }
}
