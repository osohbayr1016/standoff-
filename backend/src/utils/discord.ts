
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

export async function createMatchChannels(
    guildId: string,
    playerIds: string[],
    botToken: string,
    matchId: string
): Promise<{ voiceId?: string, textId?: string }> {
    try {
        console.log(`Creating channels for match ${matchId} with players: ${playerIds.join(', ')}`);

        // Voice Channel Type = 2
        const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: `Match #${matchId.substring(0, 4)}`,
                type: 2, // Voice Channel
                user_limit: 10,
                permission_overwrites: [
                    {
                        id: guildId, // @everyone
                        type: 0, // Role
                        deny: "1024" // Deny View Channel (1024)
                    },
                    ...playerIds.map(id => ({
                        id: id,
                        type: 1, // Member
                        allow: "1024" // Allow View Channel
                    }))
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to create match channel:', response.status, errorText);
            return {};
        }

        const channel = await response.json() as { id: string };
        return { voiceId: channel.id };

    } catch (error) {
        console.error('Create match channel error:', error);
        return {};
    }
}
