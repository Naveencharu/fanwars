"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import FanWarsLogo from "@/components/fanwars-logo";

type AppHeaderProps = {
    showBackToHome?: boolean;
};

export default function AppHeader({
    showBackToHome = false,
}: AppHeaderProps) {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    return (
        <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/95 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">

                {/* Logo */}
                <FanWarsLogo href="/" size="md" />

                {/* Desktop Navigation */}
                <nav className="hidden items-center gap-7 md:flex">

                    <Link
                        href="/home"
                        className={`text-sm font-bold transition ${isActive("/home")
                                ? "text-purple-600"
                                : "text-[#686577] hover:text-[#171525]"
                            }`}
                    >
                        Home
                    </Link>

                    <Link
                        href="/tribes"
                        className={`text-sm font-bold transition ${isActive("/tribes")
                                ? "text-purple-600"
                                : "text-[#686577] hover:text-[#171525]"
                            }`}
                    >
                        Tribes
                    </Link>

                    <Link
                        href="/rankings"
                        className={`text-sm font-bold transition ${isActive("/rankings")
                                ? "text-purple-600"
                                : "text-[#686577] hover:text-[#171525]"
                            }`}
                    >
                        Rankings
                    </Link>

                    <Link
                        href="/profile"
                        className={`text-sm font-bold transition ${isActive("/profile")
                                ? "text-purple-600"
                                : "text-[#686577] hover:text-[#171525]"
                            }`}
                    >
                        Profile
                    </Link>

                    {showBackToHome && (
                        <Link
                            href="/home"
                            className="rounded-full bg-[#171525] px-4 py-2 text-xs font-extrabold text-white transition hover:opacity-90"
                        >
                            ← Back to Home
                        </Link>
                    )}

                </nav>

                {/* Mobile */}
                <div className="flex items-center gap-2 md:hidden">

                    {showBackToHome && (
                        <Link
                            href="/home"
                            className="rounded-full bg-[#171525] px-3 py-2 text-xs font-extrabold text-white"
                        >
                            ← Home
                        </Link>
                    )}

                    <Link
                        href="/profile"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-50 text-sm font-black text-purple-700"
                        aria-label="Profile"
                    >
                        P
                    </Link>

                </div>
            </div>

            {/* Mobile Navigation */}
            <div className="border-t border-black/[0.05] md:hidden">
                <nav className="mx-auto flex max-w-7xl items-center justify-center gap-7 px-5 py-3">

                    <Link
                        href="/home"
                        className={`text-xs font-bold ${isActive("/home")
                                ? "text-purple-600"
                                : "text-[#686577]"
                            }`}
                    >
                        Home
                    </Link>

                    <Link
                        href="/tribes"
                        className={`text-xs font-bold ${isActive("/tribes")
                                ? "text-purple-600"
                                : "text-[#686577]"
                            }`}
                    >
                        Tribes
                    </Link>

                    <Link
                        href="/rankings"
                        className={`text-xs font-bold ${isActive("/rankings")
                                ? "text-purple-600"
                                : "text-[#686577]"
                            }`}
                    >
                        Rankings
                    </Link>

                    <Link
                        href="/profile"
                        className={`text-xs font-bold ${isActive("/profile")
                                ? "text-purple-600"
                                : "text-[#686577]"
                            }`}
                    >
                        Profile
                    </Link>

                </nav>
            </div>
        </header>
    );
}