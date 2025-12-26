import { Client, Guild, GuildMember } from 'discord.js';

export class ModeratorService {
    private moderatorRoleId: string;
    private guildId: string;

    constructor(private client: Client, guildId: string, roleId: string) {
        this.guildId = guildId;
        this.moderatorRoleId = roleId;
        console.log(`✅ ModeratorService initialized (Guild: ${guildId}, Role: ${roleId})`);
    }

    /**
     * Check if a Discord user has the moderator role
     */
    async checkModeratorRole(discordId: string): Promise<boolean> {
        try {
            const guild = await this.client.guilds.fetch(this.guildId);
            if (!guild) {
                console.error(`❌ Guild ${this.guildId} not found`);
                return false;
            }

            const member = await guild.members.fetch(discordId);
            if (!member) {
                console.error(`❌ Member ${discordId} not found in guild`);
                return false;
            }

            const hasRole = member.roles.cache.has(this.moderatorRoleId);
            console.log(`🔍 User ${discordId} moderator check: ${hasRole}`);
            return hasRole;
        } catch (error) {
            console.error(`❌ Error checking moderator role:`, error);
            return false;
        }
    }

    /**
     * Get all members with moderator role
     */
    async getModerators(): Promise<GuildMember[]> {
        try {
            const guild = await this.client.guilds.fetch(this.guildId);
            if (!guild) {
                console.error(`❌ Guild ${this.guildId} not found`);
                return [];
            }

            // Fetch all members (might need to enable privileged intents)
            await guild.members.fetch();

            const moderators = guild.members.cache.filter(
                member => member.roles.cache.has(this.moderatorRoleId)
            );

            return Array.from(moderators.values());
        } catch (error) {
            console.error(`❌ Error fetching moderators:`, error);
            return [];
        }
    }

    /**
     * Get user's Discord roles
     */
    async getUserRoles(discordId: string): Promise<string[]> {
        try {
            const guild = await this.client.guilds.fetch(this.guildId);
            if (!guild) return [];

            const member = await guild.members.fetch(discordId);
            if (!member) return [];

            return Array.from(member.roles.cache.values()).map(role => role.name);
        } catch (error) {
            console.error(`❌ Error fetching user roles:`, error);
            return [];
        }
    }
}
