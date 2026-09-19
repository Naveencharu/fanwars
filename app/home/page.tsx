"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import FanWarsLogo from "@/components/fanwars-logo";
import { supabase } from "@/lib/supabase";

type Profile = {
    display_name: string;
    handler: string;
};

type Tribe = {
    id: number;
    name: string;
    description: string | null;
};

type Battle = {
    id: number;
    title: string;
    description: string | null;
    category: string;
    status: string;
};

type BattleOption = {
    id: number;
    battle_id: number;
    name: string;
    position: number;
};

export default function HomePage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [tribes, setTribes] = useState<Tribe[]>([]);
    const [battles, setBattles] = useState<Battle[]>([]);
    const [options, setOptions] = useState<Record<number, BattleOption[]>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadHome() {
            try {
                setLoading(true);
                setError("");

                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                    window.location.href = "/login";
                    return;
                }

                /* Profile */

                const { data: profileData, error: profileError } =
                    await supabase
                        .from("profiles")
                        .select("display_name, handler")
                        .eq("id", user.id)
                        .maybeSingle();

                if (profileError) {
                    throw profileError;
                }

                if (!profileData) {
                    window.location.href = "/onboarding";
                    return;
                }

                setProfile(profileData);

                /* User Tribes */

                const { data: membershipData, error: membershipError } =
                    await supabase
                        .from("tribe_members")
                        .select("tribe_id")
                        .eq("user_id", user.id);

                if (membershipError) {
                    throw membershipError;
                }

                const tribeIds = (membershipData || []).map(
                    (item) => item.tribe_id
                );

                if (tribeIds.length > 0) {
                    const { data: tribeData, error: tribeError } =
                        await supabase
                            .from("tribes")
                            .select("id, name, description")
                            .in("id", tribeIds)
                            .order("id", { ascending: true });

                    if (tribeError) {
                        throw tribeError;
                    }

                    setTribes((tribeData || []) as Tribe[]);
                } else {
                    setTribes([]);
                }

                /* Live Battles */

                const { data: battleData, error: battleError } =
                    await supabase
                        .from("battles")
                        .select("id, title, description, category, status")
                        .eq("status", "live")
                        .order("id", { ascending: true });

                if (battleError) {
                    throw battleError;
                }

                const liveBattles = (battleData || []) as Battle[];

                setBattles(liveBattles);

                /* Battle Options */

                if (liveBattles.length > 0) {
                    const battleIds = liveBattles.map((battle) => battle.id);

                    const { data: optionData, error: optionError } =
                        await supabase
                            .from("battle_options")
                            .select("id, battle_id, name, position")
                            .in("battle_id", battleIds)
                            .order("position", { ascending: true });

                    if (optionError) {
                        throw optionError;
                    }

                    const grouped: Record<number, BattleOption[]> = {};

                    (optionData || []).forEach((option) => {
                        if (!grouped[option.battle_id]) {
                            grouped[option.battle_id] = [];
                        }

                        grouped[option.battle_id].push(option);
                    });

                    setOptions(grouped);
                }
            } catch (err) {
                console.error("Home loading error:", err);
                setError("We couldn't load your FanWars home.");
            } finally {
                setLoading(false);
            }
        }

        loadHome();
    }, []);

    if (loading) {
        return (
            <main className="min-h-screen bg-[#fcfbf8]">
                <header className="border-b border-black/[0.06] bg-white">
                    <div className="mx-auto flex h-16 max-w-7xl items-center px-5 sm:px-8">
                        <FanWarsLogo href="/" size="md" />
                    </div>
                </header>

                <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
                    <div className="h-64 animate-pulse rounded-[2rem] bg-white ring-1 ring-black/[0.05]" />
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-screen bg-[#fcfbf8] text-[#171525]">
                <header className="border-b border-black/[0.06] bg-white">
                    <div className="mx-auto flex h-16 max-w-7xl items-center px-5 sm:px-8">
                        <FanWarsLogo href="/" size="md" />
                    </div>
                </header>

                <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
                    <div className="rounded-[2rem] border border-red-100 bg-red-50 p-8 text-center">
                        <h1 className="text-xl font-black">
                            Something went wrong
                        </h1>

                        <p className="mt-2 text-sm text-red-700">
                            {error}
                        </p>

                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="mt-6 rounded-full bg-[#171525] px-6 py-3 text-sm font-extrabold text-white"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#fcfbf8] text-[#171525]">

            {/* HEADER */}

            <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/95 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">

                    <FanWarsLogo href="/" size="md" />

                    {/* Desktop Navigation */}

                    <nav className="hidden items-center gap-8 md:flex">

                        <Link
                            href="/home"
                            className="text-sm font-extrabold text-purple-600"
                        >
                            Home
                        </Link>

                        <Link
                            href="/tribes"
                            className="text-sm font-bold text-[#686577] transition hover:text-[#171525]"
                        >
                            Tribes
                        </Link>

                        <Link
                            href="/rankings"
                            className="text-sm font-bold text-[#686577] transition hover:text-[#171525]"
                        >
                            Rankings
                        </Link>

                        <Link
                            href="/profile"
                            className="text-sm font-bold text-[#686577] transition hover:text-[#171525]"
                        >
                            Profile
                        </Link>

                    </nav>

                    {/* Profile Identity */}

                    {profile && (
                        <Link
                            href="/profile"
                            className="group rounded-2xl px-3 py-2 text-right transition hover:bg-[#f7f5ff]"
                            aria-label="Open your FanPage"
                        >
                            <div className="text-sm font-black group-hover:text-purple-600">
                                {profile.display_name}
                            </div>

                            <div className="text-xs font-semibold text-[#9a97a5]">
                                @{profile.handler}
                            </div>
                        </Link>
                    )}

                </div>

                {/* Mobile Navigation */}

                <div className="border-t border-black/[0.05] md:hidden">
                    <nav className="mx-auto flex max-w-7xl items-center justify-center gap-7 px-5 py-3">

                        <Link
                            href="/home"
                            className="text-xs font-extrabold text-purple-600"
                        >
                            Home
                        </Link>

                        <Link
                            href="/tribes"
                            className="text-xs font-bold text-[#686577]"
                        >
                            Tribes
                        </Link>

                        <Link
                            href="/rankings"
                            className="text-xs font-bold text-[#686577]"
                        >
                            Rankings
                        </Link>

                        <Link
                            href="/profile"
                            className="text-xs font-bold text-[#686577]"
                        >
                            Profile
                        </Link>

                    </nav>
                </div>
            </header>

            {/* MAIN */}

            <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">

                {/* Welcome */}

                <section className="rounded-[2rem] bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 px-7 py-10 sm:px-10 sm:py-12">

                    <div className="max-w-4xl">

                        <div className="text-xs font-black uppercase tracking-[0.16em] text-purple-600">
                            Your FanWars
                        </div>

                        <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                            Hey {profile?.display_name}
                        </h1>

                        <div className="mt-1 text-4xl">
                            👋
                        </div>

                        <p className="mt-4 text-base text-[#575466] sm:text-lg">
                            Your passions. Your tribes. Your battles.
                        </p>

                        <p className="mt-2 text-sm text-[#777384]">
                            Pick a side and make your voice count.
                        </p>

                    </div>

                </section>

                {/* TRIBES */}

                <section className="mt-10">

                    <div className="flex items-end justify-between gap-4">

                        <div>

                            <div className="text-xs font-black uppercase tracking-[0.16em] text-[#9a97a5]">
                                Your Passions
                            </div>

                            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">
                                Your Tribes
                            </h2>

                        </div>

                        <Link
                            href="/tribes"
                            className="text-sm font-extrabold text-purple-600 transition hover:text-purple-700"
                        >
                            Explore tribes →
                        </Link>

                    </div>

                    {tribes.length === 0 ? (

                        <div className="mt-5 rounded-[2rem] border border-black/[0.06] bg-white p-7">

                            <p className="text-sm font-semibold text-[#777384]">
                                You haven't joined any tribes yet.
                            </p>

                            <Link
                                href="/tribes"
                                className="mt-4 inline-flex rounded-full bg-[#171525] px-5 py-3 text-sm font-extrabold text-white"
                            >
                                Choose your tribes →
                            </Link>

                        </div>

                    ) : (

                        <div className="mt-5 flex flex-wrap gap-3">

                            {tribes.map((tribe) => (

                                <div
                                    key={tribe.id}
                                    className="rounded-full border border-purple-100 bg-white px-5 py-3 text-sm font-extrabold shadow-sm"
                                >
                                    {tribe.name}
                                </div>

                            ))}

                        </div>

                    )}

                </section>

                {/* LIVE BATTLES */}

                <section className="mt-12">

                    <div>

                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-orange-600">
                            <span>⚔️</span>
                            <span>Live Now</span>
                        </div>

                        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
                            Pick your battle
                        </h2>

                        <p className="mt-2 text-base text-[#777384]">
                            Every vote moves the battle.
                        </p>

                    </div>

                    {battles.length === 0 ? (

                        <div className="mt-7 rounded-[2rem] border border-black/[0.06] bg-white p-10 text-center">

                            <div className="text-4xl">
                                ⚔️
                            </div>

                            <h3 className="mt-4 text-xl font-black">
                                No live FanWars right now
                            </h3>

                            <p className="mt-2 text-sm text-[#777384]">
                                Check back soon for the next battle.
                            </p>

                        </div>

                    ) : (

                        <div className="mt-7 grid gap-5 md:grid-cols-2">

                            {battles.map((battle) => {

                                const battleOptions =
                                    options[battle.id] || [];

                                return (

                                    <Link
                                        key={battle.id}
                                        href={`/battle/${battle.id}`}
                                        className="group rounded-[2rem] border border-black/[0.06] bg-white p-7 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
                                    >

                                        <div className="flex items-center justify-between gap-4">

                                            <span className="rounded-full bg-pink-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-pink-600">
                                                • LIVE
                                            </span>

                                            <span className="text-xs font-semibold text-[#9a97a5]">
                                                {battle.category}
                                            </span>

                                        </div>

                                        <h3 className="mt-6 text-2xl font-black tracking-[-0.03em]">
                                            {battle.title}
                                        </h3>

                                        {battle.description && (
                                            <p className="mt-2 text-sm leading-6 text-[#777384]">
                                                {battle.description}
                                            </p>
                                        )}

                                        {battleOptions.length > 0 && (

                                            <div className="mt-6 flex flex-wrap gap-2">

                                                {battleOptions.map((option) => (

                                                    <span
                                                        key={option.id}
                                                        className="rounded-full bg-[#f7f6fa] px-3 py-2 text-xs font-bold text-[#5f5b6d]"
                                                    >
                                                        {option.name}
                                                    </span>

                                                ))}

                                            </div>

                                        )}

                                        <div className="mt-7 flex items-center justify-between">

                                            <span className="text-sm font-extrabold text-purple-600">
                                                Enter FanWar
                                            </span>

                                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#171525] text-white transition group-hover:translate-x-1">
                                                →
                                            </span>

                                        </div>

                                    </Link>

                                );

                            })}

                        </div>

                    )}

                </section>

                {/* QUICK LINKS */}

                <section className="mt-12 grid gap-4 sm:grid-cols-3">

                    <Link
                        href="/profile"
                        className="group rounded-[2rem] border border-black/[0.06] bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
                    >

                        <div className="text-2xl">
                            👤
                        </div>

                        <h3 className="mt-4 font-black">
                            Your FanPage
                        </h3>

                        <p className="mt-1 text-sm text-[#777384]">
                            View your identity, tribes and FanWar history.
                        </p>

                        <div className="mt-4 text-sm font-extrabold text-purple-600">
                            View profile →
                        </div>

                    </Link>

                    <Link
                        href="/rankings"
                        className="group rounded-[2rem] border border-black/[0.06] bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
                    >

                        <div className="text-2xl">
                            🏆
                        </div>

                        <h3 className="mt-4 font-black">
                            Rankings
                        </h3>

                        <p className="mt-1 text-sm text-[#777384]">
                            See which sides are leading the live FanWars.
                        </p>

                        <div className="mt-4 text-sm font-extrabold text-purple-600">
                            View rankings →
                        </div>

                    </Link>

                    <Link
                        href="/tribes"
                        className="group rounded-[2rem] border border-black/[0.06] bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
                    >

                        <div className="text-2xl">
                            🔥
                        </div>

                        <h3 className="mt-4 font-black">
                            Explore Tribes
                        </h3>

                        <p className="mt-1 text-sm text-[#777384]">
                            Discover passions and join new communities.
                        </p>

                        <div className="mt-4 text-sm font-extrabold text-purple-600">
                            Explore tribes →
                        </div>

                    </Link>

                </section>

            </div>

            {/* FOOTER */}

            <footer className="border-t border-black/[0.05] bg-white">

                <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">

                    <FanWarsLogo
                        href="/"
                        size="sm"
                    />

                    <p className="text-xs font-semibold text-[#9a97a5]">
                        Passion creates tribes. Tribes create influence.
                    </p>

                </div>

            </footer>

        </main>
    );
}