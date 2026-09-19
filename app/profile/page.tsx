"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppHeader from "@/components/app-header";
import FanWarsLogo from "@/components/fanwars-logo";
import { supabase } from "@/lib/supabase";

type Profile = {
    id: string;
    username: string;
    handler: string;
    display_name: string;
    avatar_url: string | null;
    bio: string | null;
    created_at: string;
};

type Tribe = {
    id: number;
    name: string;
    description: string | null;
};

type BattleHistory = {
    battle_id: number;
    battle_title: string;
    category: string;
    option_id: number;
    option_name: string;
};

export default function ProfilePage() {
    const router = useRouter();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [tribes, setTribes] = useState<Tribe[]>([]);
    const [battleHistory, setBattleHistory] = useState<BattleHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        loadProfile();
    }, []);

    async function loadProfile() {
        setLoading(true);
        setError("");

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            router.replace("/login");
            return;
        }

        const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select(
                "id, username, handler, display_name, avatar_url, bio, created_at"
            )
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            console.error("Profile load failed:", profileError);
            setError("We couldn't load your profile.");
            setLoading(false);
            return;
        }

        if (!profileData) {
            router.replace("/onboarding");
            return;
        }

        setProfile(profileData);

        const { data: membershipData, error: membershipError } = await supabase
            .from("tribe_members")
            .select("tribe_id")
            .eq("user_id", user.id);

        if (membershipError) {
            console.error("Tribe membership load failed:", membershipError);
        }

        const tribeIds = (membershipData ?? []).map(
            (membership) => membership.tribe_id
        );

        if (tribeIds.length > 0) {
            const { data: tribeData, error: tribeError } = await supabase
                .from("tribes")
                .select("id, name, description")
                .in("id", tribeIds)
                .order("name");

            if (tribeError) {
                console.error("Tribe load failed:", tribeError);
            } else {
                setTribes(tribeData ?? []);
            }
        } else {
            setTribes([]);
        }

        const { data: historyData, error: historyError } =
            await supabase.rpc("get_my_battle_history");

        if (historyError) {
            console.error("Battle history load failed:", historyError);
        } else {
            setBattleHistory(historyData ?? []);
        }

        setLoading(false);
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#fcfbf8]">
                <AppHeader showBackToHome />

                <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
                    <div className="rounded-[28px] border border-black/[0.06] bg-white p-8 shadow-sm">
                        <div className="h-8 w-48 animate-pulse rounded-lg bg-black/[0.06]" />
                        <div className="mt-4 h-4 w-72 animate-pulse rounded bg-black/[0.05]" />
                        <div className="mt-10 h-32 animate-pulse rounded-2xl bg-black/[0.04]" />
                    </div>
                </main>
            </div>
        );
    }

    if (!profile) {
        return null;
    }

    const memberSince = new Date(profile.created_at).toLocaleDateString(
        undefined,
        {
            month: "short",
            year: "numeric",
        }
    );

    const uniqueBattles = new Set(
        battleHistory.map((battle) => battle.battle_id)
    ).size;

    return (
        <div className="min-h-screen bg-[#fcfbf8] text-[#171525]">
            <AppHeader showBackToHome />

            <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
                {error && (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
                        {error}
                    </div>
                )}

                {/* Profile Hero */}
                <section className="overflow-hidden rounded-[30px] border border-black/[0.06] bg-white shadow-sm">
                    <div className="h-32 bg-gradient-to-r from-purple-100 via-fuchsia-50 to-pink-100 sm:h-40" />

                    <div className="px-6 pb-7 sm:px-8">
                        <div className="-mt-12 flex flex-col gap-5 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex items-end gap-4">
                                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-purple-500 to-pink-500 text-3xl font-black text-white shadow-lg sm:h-28 sm:w-28">
                                    {profile.avatar_url ? (
                                        <img
                                            src={profile.avatar_url}
                                            alt={profile.display_name}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        profile.display_name.charAt(0).toUpperCase()
                                    )}
                                </div>

                                <div className="pb-1">
                                    <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                                        {profile.display_name}
                                    </h1>

                                    <p className="mt-1 text-sm font-semibold text-[#777286]">
                                        @{profile.handler}
                                    </p>
                                </div>
                            </div>

                            <Link
                                href="/home"
                                className="hidden rounded-full bg-[#171525] px-5 py-2.5 text-sm font-extrabold text-white transition hover:opacity-90 sm:inline-flex"
                            >
                                Back to Home
                            </Link>
                        </div>

                        {profile.bio && (
                            <p className="mt-6 max-w-2xl text-sm leading-6 text-[#686577]">
                                {profile.bio}
                            </p>
                        )}

                        <div className="mt-6 flex flex-wrap gap-2">
                            <span className="rounded-full bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700">
                                FanWars member
                            </span>

                            <span className="rounded-full bg-black/[0.04] px-3 py-1.5 text-xs font-bold text-[#686577]">
                                Joined {memberSince}
                            </span>
                        </div>
                    </div>
                </section>

                {/* Stats */}
                <section className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-[24px] border border-black/[0.06] bg-white p-6 shadow-sm">
                        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#938da0]">
                            Tribes
                        </p>
                        <p className="mt-2 text-3xl font-black">{tribes.length}</p>
                        <p className="mt-1 text-sm text-[#777286]">
                            Communities joined
                        </p>
                    </div>

                    <div className="rounded-[24px] border border-black/[0.06] bg-white p-6 shadow-sm">
                        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#938da0]">
                            FanWars
                        </p>
                        <p className="mt-2 text-3xl font-black">{uniqueBattles}</p>
                        <p className="mt-1 text-sm text-[#777286]">
                            Battles participated in
                        </p>
                    </div>

                    <div className="rounded-[24px] border border-black/[0.06] bg-white p-6 shadow-sm">
                        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#938da0]">
                            Votes
                        </p>
                        <p className="mt-2 text-3xl font-black">
                            {battleHistory.length}
                        </p>
                        <p className="mt-1 text-sm text-[#777286]">
                            Verified votes cast
                        </p>
                    </div>
                </section>

                {/* Tribes */}
                <section className="mt-8">
                    <div className="mb-4 flex items-end justify-between gap-4">
                        <div>
                            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-purple-600">
                                Your communities
                            </p>

                            <h2 className="mt-1 text-2xl font-black tracking-tight">
                                Your Tribes
                            </h2>
                        </div>

                        <Link
                            href="/tribes"
                            className="text-sm font-extrabold text-purple-600 hover:text-purple-700"
                        >
                            Manage Tribes →
                        </Link>
                    </div>

                    {tribes.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-black/[0.10] bg-white p-8 text-center">
                            <p className="font-bold">You haven't joined a Tribe yet.</p>

                            <Link
                                href="/tribes"
                                className="mt-4 inline-flex rounded-full bg-[#171525] px-5 py-2.5 text-sm font-extrabold text-white"
                            >
                                Explore Tribes
                            </Link>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {tribes.map((tribe) => (
                                <div
                                    key={tribe.id}
                                    className="rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-sm"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-xl">
                                            ✦
                                        </div>

                                        <div className="min-w-0">
                                            <h3 className="truncate font-black">{tribe.name}</h3>

                                            {tribe.description && (
                                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#777286]">
                                                    {tribe.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Battle History */}
                <section className="mt-10">
                    <div className="mb-4">
                        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-purple-600">
                            Your record
                        </p>

                        <h2 className="mt-1 text-2xl font-black tracking-tight">
                            Battle History
                        </h2>
                    </div>

                    {battleHistory.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-black/[0.10] bg-white p-8 text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-purple-50">
                                <FanWarsLogo href="/" showName={false} size="md" />
                            </div>

                            <h3 className="mt-4 text-lg font-black">
                                No battles yet
                            </h3>

                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#777286]">
                                Enter a live FanWar, choose your side, and your verified vote
                                will appear here.
                            </p>

                            <Link
                                href="/home"
                                className="mt-5 inline-flex rounded-full bg-[#171525] px-5 py-2.5 text-sm font-extrabold text-white"
                            >
                                Explore FanWars
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {battleHistory.map((battle, index) => (
                                <Link
                                    key={`${battle.battle_id}-${battle.option_id}-${index}`}
                                    href={`/battle/${battle.battle_id}`}
                                    className="group flex items-center justify-between gap-4 rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-purple-700">
                                                {battle.category}
                                            </span>

                                            <span className="text-xs font-semibold text-[#9993a3]">
                                                FanWar #{battle.battle_id}
                                            </span>
                                        </div>

                                        <h3 className="mt-2 truncate text-base font-black">
                                            {battle.battle_title}
                                        </h3>

                                        <p className="mt-1 text-sm text-[#777286]">
                                            You voted for{" "}
                                            <span className="font-extrabold text-[#171525]">
                                                {battle.option_name}
                                            </span>
                                        </p>
                                    </div>

                                    <span className="shrink-0 text-lg font-black text-purple-600 transition group-hover:translate-x-1">
                                        →
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                {/* Bottom navigation */}
                <section className="mt-10 rounded-[28px] bg-[#171525] p-7 text-white sm:p-8">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-purple-300">
                                Keep playing
                            </p>

                            <h2 className="mt-2 text-2xl font-black">
                                Your FanWars journey is just getting started.
                            </h2>

                            <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
                                Join more Tribes, enter battles, and build your FanWars
                                identity through real participation.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/tribes"
                                className="rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#171525]"
                            >
                                Tribes
                            </Link>

                            <Link
                                href="/rankings"
                                className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-extrabold text-white"
                            >
                                Rankings
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="mx-auto max-w-6xl px-5 pb-10 pt-4 text-center text-xs font-semibold text-[#9a94a5] sm:px-8">
                FanWars · Built around the passions that bring people together.
            </footer>
        </div>
    );
}