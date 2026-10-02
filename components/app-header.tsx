"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import FanWarsLogo from "@/components/fanwars-logo";
import { supabase } from "@/lib/supabase";

export default function AppHeader() {
    const pathname = usePathname();
    const router = useRouter();
    const [loggedIn, setLoggedIn] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [authRevision, setAuthRevision] = useState(0);
    const [displayName, setDisplayName] = useState("");
    const [isModerator, setIsModerator] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [signingOut, setSigningOut] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED") {
                // Keep the auth callback synchronous; load account data in the effect.
                setAuthRevision(value => value + 1);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        let active = true;
        async function loadAccount() {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (!active) return;
                if (sessionError) throw sessionError;
                setError("");
                setLoggedIn(Boolean(session));
                setDisplayName("");
                setIsModerator(false);
                setPendingCount(0);
                setAuthLoading(false);
                if (!session) return;
                const { data: profile } = await supabase.from("profiles")
                    .select("display_name").eq("id", session.user.id).maybeSingle();
                if (!active) return;
                setDisplayName(profile?.display_name ?? "");
                const { data: moderator, error: moderatorError } = await supabase.rpc("is_fanwar_moderator");
                if (!active || moderatorError) return;
                setIsModerator(Boolean(moderator));
                if (moderator) {
                    const { count } = await supabase.from("battles")
                        .select("id", { count: "exact", head: true }).eq("status", "pending");
                    if (active) setPendingCount(count ?? 0);
                }
            } catch {
                if (active) {
                    setAuthLoading(false);
                    setError("Could not check your session. Please refresh and try again.");
                }
            }
        }
        void loadAccount();
        return () => { active = false; };
    }, [pathname, authRevision]);

    useEffect(() => {
        async function refreshCount() {
            if (!isModerator) return;
            const { count, error: countError } = await supabase.from("battles")
                .select("id", { count: "exact", head: true }).eq("status", "pending");
            if (!countError) setPendingCount(count ?? 0);
        }
        window.addEventListener("fanwars:moderation-updated", refreshCount);
        return () => window.removeEventListener("fanwars:moderation-updated", refreshCount);
    }, [isModerator]);

    async function handleSignOut() {
        if (signingOut) return;
        setSigningOut(true);
        setError("");
        try {
            const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
            if (signOutError) throw signOutError;
            setLoggedIn(false);
            setDisplayName("");
            setIsModerator(false);
            setPendingCount(0);
            router.replace("/");
            router.refresh();
        } catch {
            setError("Could not sign out. Please try again.");
        } finally {
            setSigningOut(false);
        }
    }

    const links = loggedIn
        ? [["Home", "/home"], ["Tribes", "/tribes"], ["Rankings", "/rankings"], ["Create FanWar", "/create-fanwar"]]
        : [["FanWars", "/#battles"], ["Tribes", "/#tribes"], ["How it works", "/#how-it-works"]];
    if (loggedIn && isModerator) links.push([pendingCount ? "Moderation (" + pendingCount + ")" : "Moderation", "/admin/fanwars"]);

    function navigation(mobile: boolean) {
        return <nav aria-label={mobile ? "Mobile navigation" : "Main navigation"}
            className={mobile ? "flex gap-5 overflow-x-auto px-5 py-3 md:hidden" : "hidden items-center gap-5 md:flex"}>
            {links.map(([label, href]) => <Link key={href} href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={"whitespace-nowrap text-xs font-bold transition hover:text-brand-600 " + (pathname === href ? "text-brand-600" : "text-[#686577]")}>
                {label}
            </Link>)}
        </nav>;
    }

    return <header className="sticky top-0 z-40 border-b border-brand-100/60 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
            <FanWarsLogo href="/" size="md" />
            {navigation(false)}
            <div className="flex shrink-0 items-center gap-2">
                {!authLoading && (loggedIn ? <>
                    <Link href="/profile" aria-label="Open your profile" aria-current={pathname === "/profile" ? "page" : undefined}
                        className="rounded-full border border-brand-100 bg-brand-50 px-3 py-2 text-xs font-extrabold text-brand-700">
                        <span className="hidden lg:inline">{displayName || "My"} / </span>Profile
                    </Link>
                    <button type="button" onClick={handleSignOut} disabled={signingOut}
                        className="rounded-full border border-black/10 px-3 py-2 text-xs font-extrabold disabled:opacity-50">
                        {signingOut ? "Signing out..." : "Sign out"}
                    </button>
                </> : <>
                    <Link href="/login" className="px-2 py-2 text-xs font-bold">Log in</Link>
                    <Link href="/signup" className="rounded-full bg-brand-600 px-3 py-2 text-xs font-extrabold text-white">Join</Link>
                </>)}
            </div>
        </div>
        <div className="mx-auto max-w-7xl border-t border-brand-100/50 md:hidden">{navigation(true)}</div>
        {error && <p role="alert" className="mx-auto max-w-7xl px-5 pb-3 text-sm text-red-700">{error}</p>}
    </header>;
}
