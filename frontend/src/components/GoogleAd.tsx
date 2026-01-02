import React, { useEffect } from 'react';

interface GoogleAdProps {
    adClient?: string;
    adSlot?: string;
    adFormat?: string;
    fullWidthResponsive?: boolean;
    className?: string;
}

declare global {
    interface Window {
        adsbygoogle: any[];
    }
}

const GoogleAd: React.FC<GoogleAdProps> = ({
    adClient = "ca-pub-8280658512200421", // Real AdSense ID
    adSlot = "8061547099", // Real Rewards Page Ad Slot
    adFormat = "auto",
    fullWidthResponsive = true,
    className = ""
}) => {
    useEffect(() => {
        const loadAd = () => {
            try {
                if (typeof window !== 'undefined' && window.adsbygoogle) {
                    (window.adsbygoogle = window.adsbygoogle || []).push({});
                }
            } catch (e) {
                console.error("AdSense error:", e);
            }
        };

        // Small delay to ensure DOM is ready
        const timer = setTimeout(loadAd, 300);
        return () => clearTimeout(timer);
    }, [adSlot]); // Re-run if slot changes (shouldn't happen here)

    return (
        <div className={`google-ad-container ${className}`} style={{ overflow: 'hidden', minHeight: '100px' }}>
            <ins
                className="adsbygoogle"
                style={{ display: 'block' }}
                data-ad-client={adClient}
                data-ad-slot={adSlot}
                data-ad-format={adFormat}
                data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
            />
        </div>
    );
};

export default GoogleAd;
