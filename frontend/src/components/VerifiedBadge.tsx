

interface VerifiedBadgeProps {
    isVerified?: boolean;
    className?: string;
    showText?: boolean;
}

export const VerifiedBadge = ({ isVerified, className = "", showText = true }: VerifiedBadgeProps) => {
    if (!isVerified) return null;

    return (
        <div className={`inline-flex items-center gap-1 ${className}`} title="Discord Server Member">
            <svg
                viewBox="0 0 512 512"
                className="w-4 h-4 text-white fill-current"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path d="M512 268.3c-2.7 54.3-19.4 105.5-47.5 151.8-6.9 11.3-15.1 22.1-24.5 31.9-46.7 48.9-105.7 75.8-173 78.6-3.7.1-7.4.2-11.1.2-64.8 0-125.7-24-173.5-67.9-10.7-9.8-20.2-20.8-28.1-32.9C24.7 383.6 7.4 332.2 4.1 278.4.8 223.1 12.3 170.1 36.4 121.3c8.5-17.1 18.9-33.1 31-47.6C121.2 21.6 186 1.7 254.4.1c64.4-1.6 125.1 21.2 173.2 64.9 11.3 10.3 21.4 21.9 29.8 34.8 25.5 39.4 43.1 82.5 50.8 128.8 1.3 7.8 2.3 15.8 2.9 23.9.6 5.3.9 10.5.9 15.8zm-229.4 97.5c64-77.9 127.9-155.8 191.9-233.7-6-6.7-12.7-12.8-20.2-18.4-5.3-4-11-7.2-17.3-9.5-6.7-2.5-13.8-3.4-20.9-2.9-7.3.5-14.4 2.8-20.3 7.3-44.1 33.7-82.6 74.9-113.2 121.5-16.3 24.8-31 50.8-44.5 77.4C221 276.3 203.4 242.6 186.2 208.7c-2.4-4.8-5-9.4-7.8-14-6.4-10.4-16-17.6-28.1-20-13.3-2.6-25.9 1.9-35.3 10.8-30.1 28.5-60.2 56.9-90.2 85.4 3.7 3 7.3 6.1 11.2 8.9 44.5 32 80.2 73.1 109.1 119.5 28.9 46.1 49.3 96.6 61.3 149.3 5.4 23.5 9.9 47.1 12.7 71.1 21.3-6.5 42.7-13.1 63.5-19.7z" />
            </svg>
            {showText && (
                <span className="text-[10px] font-bold text-white tracking-wider bg-white/20 px-1.5 py-0.5 rounded border border-white/20">
                    VERIFIED
                </span>
            )}
        </div>
    );
};
