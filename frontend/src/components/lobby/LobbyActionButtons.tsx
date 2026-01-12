import { memo } from 'react';
import { Button } from "@/components/ui/button";
import {
    LogOut,
    Play,
    UserPlus,
    ArrowLeft,
    RotateCcw,
    ShieldAlert
} from "lucide-react";
import type { Match } from '../../types/match';

interface LobbyActionButtonsProps {
    match: Match | null;
    user: { id: string; role?: string } | null;
    isHost: boolean;
    isInMatch: boolean;
    isProcessing: boolean;
    onJoin: () => void;
    onLeave: () => void;
    onStart: () => void;
    onSwitchTeam: () => void;
    onFillBots?: () => void;
    onCancel?: () => void;
    onBack: () => void;
}

export const LobbyActionButtons = memo(({
    match,
    user,
    isHost,
    isInMatch,
    isProcessing,
    onJoin,
    onLeave,
    onStart,
    onSwitchTeam,
    onFillBots,
    onCancel,
    onBack
}: LobbyActionButtonsProps) => {
    if (!match) return null;

    const isStaff = isHost || user?.role === 'moderator' || user?.role === 'admin';

    // Cancel Button (Host/Staff Only)
    const renderCancelButton = () => {
        if (!isStaff) return null;
        if (match.status === 'completed' || match.status === 'cancelled') return null;

        return (
            <Button
                variant="destructive"
                className="w-full lg:w-auto bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
                onClick={onCancel}
                disabled={isProcessing}
            >
                <ShieldAlert className="w-4 h-4 mr-2" />
                {match.status === 'in_progress' ? 'Cancel Match (Trolling)' : 'Cancel Match'}
            </Button>
        );
    };

    return (
        <div className="bg-[#1c1e22] rounded-xl border border-white/5 p-4 lg:p-6 sticky top-6 space-y-4">
            <div className="space-y-3">
                {/* BACK BUTTON */}
                <Button
                    variant="outline"
                    className="w-full justify-start text-muted-foreground hover:text-white border-white/10 hover:bg-white/5"
                    onClick={onBack}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Lobby List
                </Button>

                {/* MAIN ACTIONS */}
                {match.status === 'waiting' && (
                    <>
                        {!isInMatch ? (
                            <Button
                                className="w-full bg-[#5b9bd5] hover:bg-[#4a8ac4] text-white font-bold h-12 text-base shadow-[0_0_20px_rgba(91,155,213,0.2)]"
                                onClick={onJoin}
                                disabled={isProcessing || match.player_count >= match.max_players}
                            >
                                <UserPlus className="mr-2 h-5 w-5" />
                                Join Match
                            </Button>
                        ) : (
                            <div className="space-y-3">
                                <Button
                                    variant="destructive"
                                    className="w-full bg-[#ff3b3b]/10 hover:bg-[#ff3b3b]/20 text-[#ff3b3b] border border-[#ff3b3b]/20 font-bold h-11"
                                    onClick={onLeave}
                                    disabled={isProcessing}
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Leave Lobby
                                </Button>

                                <Button
                                    variant="outline"
                                    className="w-full border-white/10 hover:bg-white/5 text-white/80"
                                    onClick={onSwitchTeam}
                                    disabled={isProcessing}
                                >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Switch Team
                                </Button>
                            </div>
                        )}

                        {/* HOST CONTROLS */}
                        {isHost && (
                            <div className="pt-4 mt-4 border-t border-white/5 space-y-3">
                                <div className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">Host Controls</div>
                                <Button
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-11"
                                    onClick={onStart}
                                    disabled={isProcessing || (match.match_type !== 'casual' && match.player_count < 2)} // Allow casual start anytime
                                >
                                    <Play className="mr-2 h-4 w-4" />
                                    Start Match Now
                                </Button>

                                {/* FILL BOTS (DEV/TEST) */}
                                <Button
                                    variant="outline"
                                    className="w-full border-white/10 hover:bg-white/5 text-xs h-8"
                                    onClick={onFillBots}
                                >
                                    🤖 Fill Bots (Test)
                                </Button>
                            </div>
                        )}
                    </>
                )}

                {/* CANCEL BUTTON */}
                {renderCancelButton()}
            </div>
        </div>
    );
});
