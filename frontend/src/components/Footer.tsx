import { Instagram } from "lucide-react";

export default function Footer() {
  return (
    <footer className="w-full bg-zinc-950 border-t border-white/10 pt-16 pb-8 mt-auto">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex flex-col md:flex-row justify-between items-start gap-12">
          {/* Logo Section */}
          <div className="space-y-4">
            <h2 className="font-display font-black text-3xl tracking-tighter italic text-white">
              STAN<span className="text-primary">D</span>OFF 2
            </h2>
            <p className="text-sm text-gray-500 uppercase tracking-widest font-medium">
              Tournament <span className="text-primary">Hub</span>
            </p>
          </div>

          {/* Developer Links */}
          <div className="flex flex-col md:items-end gap-4">
            <div className="text-xs text-gray-600 uppercase tracking-widest font-bold">
              Developed by
            </div>
            <div className="flex flex-col gap-3">
              <a
                href="https://www.instagram.com/not_twissu_/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
              >
                <div className="p-1.5 rounded-full bg-white/5 group-hover:bg-[#E1306C]/10 transition-colors">
                  <Instagram className="h-4 w-4 text-[#E1306C]" />
                </div>
                <span>@not_twissu_</span>
              </a>
              <a
                href="https://www.instagram.com/a.anand_dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
              >
                <div className="p-1.5 rounded-full bg-white/5 group-hover:bg-[#E1306C]/10 transition-colors">
                  <Instagram className="h-4 w-4 text-[#E1306C]" />
                </div>
                <span>@a.anand_dev</span>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gray-600">
            © 2024 Standoff 2 Tournament Hub. All rights reserved.
          </p>
          <div className="text-xs text-gray-700">
            Not affiliated with Axlebolt.
          </div>
        </div>
      </div>
    </footer>
  );
}
