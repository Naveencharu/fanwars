"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import FanWarsLogo from "@/components/fanwars-logo";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

type Battle = {
    id: number;
    title: string;
    category: string;
    status: string;
};

type BattleOption = {
    id: number;
    battle_id: number;
    name: string;
    position: number;
};

type Result = {
    option_id: number;
    option_name: string;
    vote_count: number;
};

type RankedOption = {
    option_id: number;
    name: string;
    votes: number;
    battleTitle: string;
    category: string;
};

function getOptionEmoji(name: string) {
    if (name.toLowerCase().includes("chai")) return "☕";
    if (name.toLowerCase().includes("coffee")) return "☕";
    if (name.toLowerCase().includes("cricket")) return "🏏";
    if (name.toLowerCase().includes("football")) return "⚽";
    if (name.toLowerCase().includes("biryani")) return "🍛";
    if (name.toLowerCase().includes("pizza")) return "🍕";
    if (name.toLowerCase().includes("marvel")) return "🦸";
    if (name.toLowerCase().includes("dc")) return "⚡";
    return "🔥";
}

function getOptionStyle(name: string) {
    const value = name.toLowerCase();

    if (value.includes("chai")) {
        return "from-amber-50 to-orange-50 border-amber-100";
    }

    if (value.includes("coffee")) {
        return "from-stone-50 to-amber-50 border-stone-200";
    }

    if (value.includes("cricket")) {
        return "from-emerald-50 to-green-50 border-emerald-100";
    }

    if (value.includes("football")) {
        return "from-slate-50 to-gray-50 border-slate-200";
    }

    if (value.includes("biryani")) {
        return "from-orange-50 to-red-50 border-orange-100";
    }

    if (value.includes("pizza")) {
        return "from-red-50 to-rose-50 border-red-100";
    }

    if (value.includes("marvel")) {
        return "from-red-50 to-pink-50 border-red-100";
    }

    if (value.includes("dc")) {
        return "from-blue-50 to-indigo-50 border-blue-100";
    }

    return "from-purple-50 to-pink-50 border-purple-100";
}

export default function RankingsPage() {
    const [battles, setBattles] = useState<Battle[]>([]);
    const [rankings, setRankings] = useState<RankedOption[]>([]);
    const [totalVotes, setTotalVotes] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    async function loadRankings() {
        try {
            setError("");

            const { data: battleData, error: battleError } = await supabase
                .from("battles")
                .select("id, title, category, status")
                .eq("status", "live")
                .order("id", { ascending: true });

            if (battleError) {
                throw battleError;
            }

            const liveBattles = (battleData || []) as Battle[];

            setBattles(liveBattles);

            const rankingRows: RankedOption[] = [];

            for (const battle of liveBattles) {
                const { data: resultData, error: resultError } =
                    await supabase.rpc("get_battle_results", {
                        p_battle_id: battle.id,
                    });

                if (resultError) {
                    throw resultError;
                }

                const results = (resultData || []) as Result[];

                results.forEach((result) => {
                    rankingRows.push({
                        option_id: result.option_id,
                        name: result.option_name,
                        votes: Number(result.vote_count),
                        battleTitle: battle.title,
                        category: battle.category,
                    });
                });
            }

            rankingRows.sort((a, b) => b.votes - a.votes);

            setRankings(rankingRows);

            setTotalVotes(
                rankingRows.reduce((sum, item) => sum + item.votes, 0)
            );
        } catch (err) {
            console.error("Failed to load rankings:", err);
            setError("We couldn't load the rankings right now.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadRankings();

        const interval = setInterval(loadRankings, 5000);

        return () => clearInterval(interval);
    }, []);

    return (
        <main className="min-h-screen bg-[#fcfbf8] text-[#171525]">
            {/* Header */}
            <AppHeader />

            {/* Hero */}
            <section className="border-b border-black/[0.05] bg-white">
                <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
                    <div className="max-w-3xl">
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-purple-700">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-purple-500" />
                            Live Rankings
                        </div>

                        <h1 className="text-4xl font-black tracking-[-0.045em] sm:text-6xl">
                            Who has the{" "}
                            <span className="bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
                                Fan Power?
                            </span>
                        </h1>

                        <p className="mt-5 max-w-2xl text-base leading-7 text-[#686577] sm:text-lg">
                            See how tribes are performing across the live FanWars. Every
                            ranking is powered by real votes.
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="mt-10 grid gap-4 sm:grid-cols-3">
                        <div className="rounded-3xl border border-black/[0.06] bg-[#fcfbf8] p-6">
                            <div className="text-sm font-bold text-[#777384]">
                                Live FanWars
                            </div>

                            <div className="mt-2 text-3xl font-black">
                                {loading ? "—" : battles.length}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-black/[0.06] bg-[#fcfbf8] p-6">
                            <div className="text-sm font-bold text-[#777384]">
                                Total Votes
                            </div>

                            <div className="mt-2 text-3xl font-black">
                                {loading ? "—" : totalVotes.toLocaleString()}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-black/[0.06] bg-[#fcfbf8] p-6">
                            <div className="text-sm font-bold text-[#777384]">
                                Tribes Competing
                            </div>

                            <div className="mt-2 text-3xl font-black">
                                {loading ? "—" : rankings.length}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Rankings */}
            <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
                <div className="mb-8 flex items-end justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black tracking-[-0.03em] sm:text-3xl">
                            FanWars Leaderboard
                        </h2>

                        <p className="mt-2 text-sm text-[#777384]">
                            Updated automatically as fans vote.
                        </p>
                    </div>

                    <div className="hidden rounded-full bg-white px-4 py-2 text-xs font-bold text-[#777384] shadow-sm ring-1 ring-black/[0.05] sm:block">
                        ● Live
                    </div>
                </div>

                {error && (
                    <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="grid gap-4">
                        {[1, 2, 3, 4].map((item) => (
                            <div
                                key={item}
                                className="h-28 animate-pulse rounded-3xl bg-white ring-1 ring-black/[0.05]"
                            />
                        ))}
                    </div>
                ) : rankings.length === 0 ? (
                    <div className="rounded-[2rem] border border-black/[0.06] bg-white p-10 text-center">
                        <div className="text-5xl">🏆</div>

                        <h3 className="mt-4 text-xl font-black">
                            No votes yet
                        </h3>

                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#777384]">
                            Be the first fan to enter a live FanWar and put your tribe on
                            the leaderboard.
                        </p>

                        <Link
                            href="/home"
                            className="mt-6 inline-flex rounded-full bg-[#171525] px-6 py-3 text-sm font-extrabold text-white transition hover:opacity-90"
                        >
                            Enter a FanWar
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {rankings.map((item, index) => {
                            const position = index + 1;

                            const maxVotes = rankings[0]?.votes || 1;

                            const percentage =
                                maxVotes === 0
                                    ? 0
                                    : Math.round((item.votes / maxVotes) * 100);

                            return (
                                <div
                                    key={`${item.option_id}-${item.battleTitle}`}
                                    className={`group rounded-[2rem] border bg-gradient-to-br p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${getOptionStyle(
                                        item.name
                                    )}`}
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Position */}
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-black shadow-sm">
                                            {position <= 3 ? (
                                                <span>
                                                    {position === 1
                                                        ? "🥇"
                                                        : position === 2
                                                            ? "🥈"
                                                            : "🥉"}
                                                </span>
                                            ) : (
                                                position
                                            )}
                                        </div>

                                        {/* Tribe icon */}
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                                            {getOptionEmoji(item.name)}
                                        </div>

                                        {/* Main */}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="truncate text-lg font-black">
                                                    {item.name}
                                                </h3>

                                                {position === 1 && (
                                                    <span className="rounded-full bg-[#171525] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                                                        Leading
                                                    </span>
                                                )}
                                            </div>

                                            <p className="mt-1 truncate text-xs font-semibold text-[#777384]">
                                                {item.battleTitle}
                                            </p>

                                            {/* Progress */}
                                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/[0.07]">
                                                <div
                                                    className="h-full rounded-full bg-[#171525] transition-all duration-500"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Votes */}
                                        <div className="shrink-0 text-right">
                                            <div className="text-2xl font-black">
                                                {item.votes.toLocaleString()}
                                            </div>

                                            <div className="text-[11px] font-bold uppercase tracking-wide text-[#777384]">
                                                votes
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Live battles */}
            {!loading && battles.length > 0 && (
                <section className="border-t border-black/[0.05] bg-white">
                    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
                        <div className="mb-7">
                            <h2 className="text-2xl font-black tracking-[-0.03em]">
                                Live FanWars
                            </h2>

                            <p className="mt-2 text-sm text-[#777384]">
                                Jump into a battle and make your vote count.
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            {battles.map((battle) => (
                                <Link
                                    key={battle.id}
                                    href={`/battle/${battle.id}`}
                                    className="group rounded-[2rem] border border-black/[0.06] bg-[#fcfbf8] p-6 transition hover:-translate-y-1 hover:shadow-lg"
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="rounded-full bg-purple-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-purple-700">
                                            {battle.category}
                                        </span>

                                        <span className="flex items-center gap-2 text-xs font-bold text-[#777384]">
                                            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                                            LIVE
                                        </span>
                                    </div>

                                    <h3 className="mt-5 text-xl font-black tracking-[-0.025em]">
                                        {battle.title}
                                    </h3>

                                    <div className="mt-6 flex items-center justify-between">
                                        <span className="text-sm font-bold text-[#777384]">
                                            Enter FanWar
                                        </span>

                                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#171525] text-white transition group-hover:translate-x-1">
                                            →
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Footer */}
            <footer className="border-t border-black/[0.05] bg-[#fcfbf8]">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                    <FanWarsLogo href="/" size="sm" />

                    <p className="text-xs font-semibold text-[#8a8795]">
                        Passion creates tribes. Tribes create influence.
                    </p>
                </div>
            </footer>
        </main>
    );
}