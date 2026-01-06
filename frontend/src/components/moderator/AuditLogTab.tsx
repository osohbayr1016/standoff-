import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import LoadingSpinner from "../LoadingSpinner";
import type { AuditLog } from "./types";

interface AuditLogTabProps {
    backendUrl: string;
    userId: string;
}

export default function AuditLogTab({ backendUrl, userId }: AuditLogTabProps) {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchLogs(1);
    }, []);

    const fetchLogs = async (pageNum: number) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${backendUrl}/api/moderator/audit-logs?page=${pageNum}&limit=50`, {
                headers: { 'X-User-Id': userId },
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                const logsData = data.logs || [];

                if (pageNum === 1) setLogs(logsData);
                else setLogs(prev => [...prev, ...logsData]);

                if (logsData.length < 50) setHasMore(false);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="bg-[#1e1f22] border-white/5">
            <CardContent className="p-0">
                <div className="h-[600px] overflow-y-auto">
                    <div className="divide-y divide-white/5">
                        {isLoading && logs.length === 0 ? (
                            <div className="flex justify-center py-12">
                                <LoadingSpinner />
                            </div>
                        ) : (
                            logs.map((log) => (
                                <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-white/5 transition-colors">
                                    <Avatar className="h-8 w-8 mt-1">
                                        <AvatarImage src={`https://cdn.discordapp.com/avatars/${log.moderator_id}/${log.moderator_avatar}.png`} />
                                        <AvatarFallback>M</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium text-white">
                                                <span className="text-blue-400">{log.moderator_username}</span>
                                                <span className="text-zinc-500 mx-2">performed</span>
                                                <span className="text-yellow-500 font-mono text-xs uppercase bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">
                                                    {log.action_type}
                                                </span>
                                            </p>
                                            <span className="text-xs text-zinc-500 whitespace-nowrap">
                                                {new Date(log.created_at).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-sm text-zinc-400 break-all">
                                            {log.details}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}

                        {hasMore && (
                            <div className="p-4 text-center">
                                <button
                                    onClick={() => {
                                        const nextPage = page + 1;
                                        setPage(nextPage);
                                        fetchLogs(nextPage);
                                    }}
                                    className="text-sm text-blue-500 hover:text-blue-400 transition-colors"
                                    disabled={isLoading}
                                >
                                    {isLoading ? "Loading..." : "Load Older Logs"}
                                </button>
                            </div>
                        )}

                        {!hasMore && logs.length > 0 && (
                            <div className="p-4 text-center text-xs text-zinc-600 italic">
                                End of logs
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
