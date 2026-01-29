import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Loader2, Image as ImageIcon, Upload, X } from "lucide-react";

interface BannerEditModalProps {
    userId: string;
    currentBanner?: string | null;
    currentMode?: 'discord' | 'custom';
    isOpen: boolean;
    onClose: () => void;
    onSave: (newBannerUrl: string, newMode?: 'discord' | 'custom') => void;
    backendUrl: string;
}

export default function BannerEditModal({
    userId,
    currentBanner,
    currentMode,
    isOpen,
    onClose,
    onSave,
    backendUrl
}: BannerEditModalProps) {
    const [bannerMode, setBannerMode] = useState<'discord' | 'custom'>(currentMode || 'discord');
    const [url, setUrl] = useState(currentBanner || '');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(currentBanner || null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [inputType, setInputType] = useState<'upload' | 'url'>('upload');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset state when modal opens
    if (isOpen && bannerMode !== currentMode && currentMode) {
        // This is a bit tricky with hooks, better to use useEffect, but for now strict sync might be okay or use key on component
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            // Validate file type
            const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(selectedFile.type)) {
                setError('Invalid file type. Allowed: PNG, JPG, GIF, WEBP');
                return;
            }
            // Validate file size (max 5MB)
            if (selectedFile.size > 5 * 1024 * 1024) {
                setError('File too large. Maximum size is 5MB');
                return;
            }
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
            setError('');
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(droppedFile.type)) {
                setError('Invalid file type. Allowed: PNG, JPG, GIF, WEBP');
                return;
            }
            if (droppedFile.size > 5 * 1024 * 1024) {
                setError('File too large. Maximum size is 5MB');
                return;
            }
            setFile(droppedFile);
            setPreview(URL.createObjectURL(droppedFile));
            setError('');
        }
    };

    const handleUrlChange = (newUrl: string) => {
        setUrl(newUrl);
        setPreview(newUrl);
        setFile(null);
    };

    const handleSave = async () => {
        setIsLoading(true);
        setError('');

        try {
            if (bannerMode === 'discord') {
                // Switch to Discord Mode
                const res = await fetch(`${backendUrl}/api/profile/banner/mode`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, mode: 'discord' })
                });

                if (!res.ok) throw new Error('Failed to update mode');

                onSave('', 'discord');
                onClose();
            } else {
                // Custom Mode - Save Banner (which also sets mode to custom)
                if (inputType === 'upload' && file) {
                    const formData = new FormData();
                    formData.append('userId', userId);
                    formData.append('file', file);

                    const res = await fetch(`${backendUrl}/api/profile/banner/upload`, {
                        method: 'POST',
                        body: formData
                    });

                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Failed to upload banner');

                    onSave(data.bannerUrl, 'custom');
                    onClose();
                } else if (inputType === 'url' && url) {
                    try { new URL(url); } catch { throw new Error('Invalid URL'); }

                    const res = await fetch(`${backendUrl}/api/profile/banner`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, bannerUrl: url })
                    });

                    if (!res.ok) throw new Error('Failed to update banner');

                    onSave(url, 'custom');
                    onClose();
                } else if (!file && !url && currentBanner) {
                    // Just switching mode back to custom without changing image?
                    const res = await fetch(`${backendUrl}/api/profile/banner/mode`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, mode: 'custom' })
                    });
                    if (!res.ok) throw new Error('Failed to update mode');
                    onSave(currentBanner, 'custom');
                    onClose();
                } else {
                    setError('Please select an image or enter a URL');
                    setIsLoading(false);
                    return;
                }
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to save. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const clearFile = () => {
        setFile(null);
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#1e2024] border-[#2a2d35] text-white sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit Profile Banner (VIP)</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Choose between your Discord server banner or a custom animated banner.
                    </DialogDescription>
                </DialogHeader>

                {/* Main Mode Toggle */}
                <div className="flex gap-2 p-1 bg-[#121418] rounded-lg mb-2">
                    <button
                        onClick={() => setBannerMode('discord')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-bold transition-all ${bannerMode === 'discord' ? 'bg-[#5865F2] text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Discord Banner
                    </button>
                    <button
                        onClick={() => setBannerMode('custom')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-bold transition-all ${bannerMode === 'custom' ? 'bg-[#ffa500] text-black shadow-none' : 'text-gray-400 hover:text-white'}`}
                        style={bannerMode === 'custom' ? { boxShadow: '0 0 10px rgba(255, 165, 0, 0.3)' } : {}}
                    >
                        Custom Banner
                    </button>
                </div>

                {bannerMode === 'discord' ? (
                    <div className="text-center py-8 space-y-4">
                        <div className="bg-[#121418] p-4 rounded-lg border border-[#2a2d35]">
                            <p className="text-gray-300 text-sm">
                                Your profile will use your <b>Standoff 2 Server Profile Banner</b> from Discord.
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                                (If you don't have one set in the server, it will use your valid global banner).
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 py-2">
                        {/* Input Type Toggle */}
                        <div className="flex gap-2 text-xs">
                            <button
                                onClick={() => setInputType('upload')}
                                className={`px-3 py-1 rounded-full border transition-all ${inputType === 'upload' ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
                            >
                                Upload File
                            </button>
                            <button
                                onClick={() => setInputType('url')}
                                className={`px-3 py-1 rounded-full border transition-all ${inputType === 'url' ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
                            >
                                Image URL
                            </button>
                        </div>

                        {inputType === 'upload' ? (
                            <div
                                onDrop={handleDrop}
                                onDragOver={(e) => e.preventDefault()}
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-[#2a2d35] hover:border-[#ffa500]/50 rounded-lg p-6 text-center cursor-pointer transition-colors bg-[#121418]"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/gif,image/webp"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                {file ? (
                                    <div className="flex items-center justify-center gap-3">
                                        <ImageIcon className="h-6 w-6 text-[#ffa500]" />
                                        <span className="text-sm text-white truncate max-w-[200px]">{file.name}</span>
                                        <button onClick={(e) => { e.stopPropagation(); clearFile(); }} className="p-1 hover:bg-white/10 rounded">
                                            <X className="h-4 w-4 text-gray-400" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Upload className="h-10 w-10 mx-auto text-gray-500" />
                                        <p className="text-sm text-gray-400">Drop an image here or click to browse</p>
                                        <p className="text-xs text-gray-600">PNG, JPG, GIF, WEBP • Max 5MB</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Image URL</label>
                                <Input
                                    value={url}
                                    onChange={(e) => handleUrlChange(e.target.value)}
                                    placeholder="https://imgur.com/..."
                                    className="bg-[#121418] border-[#2a2d35]"
                                />
                            </div>
                        )}

                        {/* Preview */}
                        <div className="rounded-lg border border-[#2a2d35] bg-[#121418] overflow-hidden relative h-32 flex items-center justify-center">
                            {preview ? (
                                <img src={preview} alt="Preview" className="w-full h-full object-cover" onError={() => setError("Image failed to load")} />
                            ) : (
                                <div className="text-gray-600 flex flex-col items-center">
                                    <ImageIcon className="h-8 w-8 mb-1" />
                                    <span className="text-xs">Preview</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {error && <p className="text-red-500 text-xs text-center">{error}</p>}

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
                    <Button
                        onClick={handleSave}
                        disabled={isLoading || (bannerMode === 'custom' && !file && !url && !currentBanner)}
                        className={`${bannerMode === 'custom' ? 'bg-[#ffa500] hover:bg-[#ffb733] text-black' : 'bg-[#5865F2] hover:bg-[#4752C4] text-white'} font-bold transition-colors`}
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {bannerMode === 'custom' ? 'Save Custom Banner' : 'Use Discord Banner'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
