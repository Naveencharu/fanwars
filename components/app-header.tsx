"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import FanWarsLogo from "@/components/fanwars-logo";
import { supabase } from "@/lib/supabase";

type AppHeaderProps = {
    showBackToHome?: boolean;
};

export default function AppHeader({
    showBackToHome = false,
}: AppHeaderProps) {
    const pathname = usePathname();

    const isActive = (path: string) =>
        pathname === path ||
        (path === "/admin/fanwars" &&
            pathname.startsWith("/admin/fanwars"));

    const [displayName, setDisplayName] = useState("");
    const [handler, setHandler] = useState("");
    const [isModerator, setIsModerator] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    async function handleSignOut() {
        await supabase.auth.signOut();
        window.location.href = "/login";
    }

    useEffect(() => {
        async function loadCurrentUser() {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) return;

                const { data: profile } = await supabase
                    .from("profiles")
                    .select("display_name, handler")
                    .eq("id", user.id)
                    .maybeSingle();

                if (profile) {
                    setDisplayName(profile.display_name ?? "");
                    setHandler(profile.handler ?? "");
                }

                /*
                 * Check whether the current user is a FanWars moderator.
                 */
                const {
                    data: moderator,
                    error: moderatorError,
                } = await supabase.rpc("is_fanwar_moderator");

                if (moderatorError) {
                    console.error(
                        "Moderator check failed:",
                        moderatorError
                    );
                    return;
                }

                if (!moderator) {
                    setIsModerator(false);
                    return;
                }

                setIsModerator(true);

                /*
                 * Moderator only:
                 * get the number of FanWars waiting for review.
                 */
                const {
                    count,
                    error: countError,
                } = await supabase
                    .from("battles")
                    .select("id", {
                        count: "exact",
                        head: true,
                    })
                    .eq("status", "pending");

                if (countError) {
                    console.error(
                        "Pending FanWar count failed:",
                        countError
                    );
                    return;
                }

                setPendingCount(count ?? 0);
            } catch (error) {
                console.error(
                    "AppHeader user loading error:",
                    error
                );
            }
        }

        loadCurrentUser();
    }, [pathname]);
    useEffect(() => {
        async function refreshModerationCount() {
            if (!isModerator) return;

            const { count, error: countError } = await supabase
                .from("battles")
                .select("id", {
                    count: "exact",
                    head: true,
                })
                .eq("status", "pending");

            if (countError) {
                console.error(
                    "Pending FanWar count refresh failed:",
                    countError
                );
                return;
            }

            setPendingCount(count ?? 0);
        }

        function handleModerationUpdated() {
            refreshModerationCount();
        }

        window.addEventListener(
            "fanwars:moderation-updated",
            handleModerationUpdated
        );

        return () => {
            window.removeEventListener(
                "fanwars:moderation-updated",
                handleModerationUpdated
            );
        };
    }, [isModerator]);
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
                        href="/create-fanwar"
                        className={`text-sm font-bold transition ${isActive("/create-fanwar")
                            ? "text-purple-600"
                            : "text-[#686577] hover:text-[#171525]"
                            }`}
                    >
                        Create FanWar
                    </Link>

                    {isModerator && (
                        <Link
                            href="/admin/fanwars"
                            className={`flex items-center gap-2 text-sm font-bold transition ${isActive("/admin/fanwars")
                                ? "text-purple-600"
                                : "text-[#686577] hover:text-[#171525]"
                                }`}
                        >
                            Moderation

                            {pendingCount > 0 && (
                                <span className="flex min-w-5 items-center justify-center rounded-full bg-purple-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                                    {pendingCount}
                                </span>
                            )}
                        </Link>
                    )}

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

                {/* Current User */}
                <Link
                    href="/profile"
                    className="hidden items-center gap-3 rounded-full border border-purple-100 bg-white px-4 py-2 md:flex"
                >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-xs font-black text-purple-700">
                        {displayName
                            ? displayName.charAt(0).toUpperCase()
                            : "F"}
                    </div>

                    <div className="min-w-0 text-left leading-tight">
                        <p className="max-w-[140px] truncate text-xs font-extrabold text-[#171525]">
                            {displayName || "Fan"}
                        </p>

                        <p className="max-w-[140px] truncate text-[10px] font-semibold text-[#8a8395]">
                            {handler ? `@${handler}` : ""}
                        </p>
                    </div>
                </Link>

                <button
                    type="button"
                    onClick={handleSignOut}
                    className="hidden rounded-full border border-black/[0.08] bg-white px-4 py-2 text-xs font-extrabold text-[#171525] transition hover:bg-black/[0.03] md:block"
                >
                    Sign Out
                </button>

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
                        {displayName
                            ? displayName.charAt(0).toUpperCase()
                            : "F"}
                    </Link>
                </div>
            </div>

            {/* Mobile Navigation */}
            <div className="border-t border-black/[0.05] md:hidden">
                <nav className="mx-auto flex max-w-7xl items-center justify-center gap-5 overflow-x-auto px-5 py-3">
                    <Link
                        href="/home"
                        className={`whitespace-nowrap text-xs font-bold ${isActive("/home")
                            ? "text-purple-600"
                            : "text-[#686577]"
                            }`}
                    >
                        Home
                    </Link>

                    <Link
                        href="/tribes"
                        className={`whitespace-nowrap text-xs font-bold ${isActive("/tribes")
                            ? "text-purple-600"
                            : "text-[#686577]"
                            }`}
                    >
                        Tribes
                    </Link>

                    <Link
                        href="/rankings"
                        className={`whitespace-nowrap text-xs font-bold ${isActive("/rankings")
                            ? "text-purple-600"
                            : "text-[#686577]"
                            }`}
                    >
                        Rankings
                    </Link>

                    <Link
                        href="/create-fanwar"
                        className={`whitespace-nowrap text-xs font-bold ${isActive("/create-fanwar")
                            ? "text-purple-600"
                            : "text-[#686577]"
                            }`}
                    >
                        Create
                    </Link>

                    {isModerator && (
                        <Link
                            href="/admin/fanwars"
                            className={`flex items-center gap-1 whitespace-nowrap text-xs font-bold ${isActive("/admin/fanwars")
                                ? "text-purple-600"
                                : "text-[#686577]"
                                }`}
                        >
                            Moderate

                            {pendingCount > 0 && (
                                <span className="flex min-w-4 items-center justify-center rounded-full bg-purple-600 px-1 py-0.5 text-[9px] font-black text-white">
                                    {pendingCount}
                                </span>
                            )}
                        </Link>
                    )}

                    <Link
                        href="/profile"
                        className={`whitespace-nowrap text-xs font-bold ${isActive("/profile")
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