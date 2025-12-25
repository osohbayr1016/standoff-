import { z } from 'zod';

// Nickname validation schema
export const nicknameSchema = z.string()
    .min(3, 'Nickname must be at least 3 characters')
    .max(16, 'Nickname must be at most 16 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed')
    .trim();

// Profile update request schema
export const updateProfileSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    nickname: nicknameSchema
});

// Profile response schema
export const profileSchema = z.object({
    id: z.string(),
    discord_id: z.string(),
    discord_username: z.string().optional(),
    discord_avatar: z.string().optional(),
    standoff_nickname: z.string().optional(),
    elo: z.number().default(1000),
    wins: z.number().default(0),
    losses: z.number().default(0),
    created_at: z.string().optional(),
    nickname_updated_at: z.string().optional()
});

export type Nickname = z.infer<typeof nicknameSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
export type Profile = z.infer<typeof profileSchema>;
