
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


