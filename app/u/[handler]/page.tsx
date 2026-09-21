"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import AppHeader from "@/components/app-header";
import FanWarsLogo from "@/components/fanwars-logo";
import { supabase } from "@/lib/supabase";

type PublicFanPage = {
    id: string;
    username: string;
    handler: string;
    display_name: string;
    avatar_url: string | null;
    bio: string | null;
    created_at: string;
    tribe_count: number;
    fanwar_count: number;
    vote_count: number;
    tribes: {
        id: number;
        name: string;
        description: string | null;
    }[];
    battle_history: {
        battle_id: number;
        battle_title: string;
        category: string;
        option_id: number;
        option_name: string;
    }[];
};

export default function PublicFanPage() {
    const params = useParams<{ handler: string }>();
    const handler = String(params.handler ?? "");

    const [fanPage, setFanPage] = useState<PublicFanPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!handler) return;

        async function loadFanPage() {
            setLoading(true);
            setError("");

            const { data, error: fanPageError } = await supabase.rpc(
                "get_public_fanpage",
                {
                    p_handler: handler,
                }
            );

            if (fanPageError) {
                console.error("Public FanPage load failed:", fanPageError);
                setError("We couldn't load this FanPage.");
                setLoading(false);
                return;
            }

            if (!data || data.length === 0) {
                setError("This FanPage doesn't exist.");
                setLoading(false);
                return;
            }

            setFanPage(data[0] as PublicFanPage);
            setLoading(false);
        }

        loadFanPage();
    }, [handler]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#fcfbf8]">
                <AppHeader />

                <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
                    <div className="rounded-[30px] border border-black/[0.06] bg-white p-8 shadow-sm">
                        <div className="h-32 animate-pulse rounded-2xl bg-black/[0.05]" />
                        <div className="mt-6 h-8 w-64 animate-pulse rounded-lg bg-black/[0.06]" />
                        <div className="mt-3 h-4 w-40 animate-pulse rounded bg-black/[0.05]" />
                    </div>
                </main>
            </div>
        );
    }

    if (!fanPage) {
        return (
            <div className="min-h-screen bg-[#fcfbf8] text-[#171525]">
                <AppHeader />

                <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
                    <div className="rounded-[30px] border border-black/[0.06] bg-white p-10 text-center shadow-sm">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-50">
                            <FanWarsLogo
                                href="/"
                                showName={false}
                                size="md"
                            />
                        </div>

                        <h1 className="mt-5 text-2xl font-black">
                            FanPage not found
                        </h1>

                        <p className="mt-2 text-sm text-[#777286]">
                            {error || "This FanPage doesn't exist."}
                        </p>

                        <Link
                            href="/home"
                            className="mt-6 inline-flex rounded-full bg-[#171525] px-5 py-2.5 text-sm font-extrabold text-white"
                        >
                            Back to Home
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    const memberSince = new Date(
        fanPage.created_at
    ).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
    });

    const uniqueBattles = new Set(
        fanPage.battle_history.map((battle) => battle.battle_id)
    ).size;
    const participationCount = fanPage.battle_history.length;
    return (
        <div className="min-h-screen bg-[#fcfbf8] text-[#171525]">
            <AppHeader />

            <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
                {/* FanPage Hero */}
                <section className="overflow-hidden rounded-[30px] border border-black/[0.06] bg-white shadow-sm">
                    <div className="h-32 bg-gradient-to-r from-purple-100 via-fuchsia-50 to-pink-100 sm:h-40" />

                    <div className="px-6 pb-7 sm:px-8">
                        <div className="-mt-12 flex flex-col gap-5 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex items-end gap-4">
                                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-purple-500 to-pink-500 text-3xl font-black text-white shadow-lg sm:h-28 sm:w-28">
                                    {fanPage.avatar_url ? (
                                        <img
                                            src={fanPage.avatar_url}
                                            alt={fanPage.display_name}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        fanPage.display_name
                                            .charAt(0)
                                            .toUpperCase()
                                    )}
                                </div>

                                <div className="pb-1">
                                    <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                                        {fanPage.display_name}
                                    </h1>

                                    <p className="mt-1 text-sm font-semibold text-[#777286]">
                                        @{fanPage.handler}
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

                        {fanPage.bio && (
                            <p className="mt-6 max-w-2xl text-sm leading-6 text-[#686577]">
                                {fanPage.bio}
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
                <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-[24px] border border-black/[0.06] bg-white p-6 shadow-sm">
                        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#938da0]">
                            Tribes
                        </p>

                        <p className="mt-2 text-3xl font-black">
                            {fanPage.tribe_count}
                        </p>

                        <p className="mt-1 text-sm text-[#777286]">
                            Communities joined
                        </p>
                    </div>
                    <div className="rounded-[24px] border border-black/[0.06] bg-white p-6 shadow-sm">
                        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#938da0]">
                            Participation
                        </p>

                        <p className="mt-2 text-3xl font-black">
                            {participationCount}
                        </p>

                        <p className="mt-1 text-sm text-[#777286]">
                            Recorded FanWars activity
                        </p>
                    </div>
                    <div className="rounded-[24px] border border-black/[0.06] bg-white p-6 shadow-sm">
                        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#938da0]">
                            FanWars
                        </p>

                        <p className="mt-2 text-3xl font-black">
                            {uniqueBattles}
                        </p>

                        <p className="mt-1 text-sm text-[#777286]">
                            Battles participated in
                        </p>
                    </div>

                    <div className="rounded-[24px] border border-black/[0.06] bg-white p-6 shadow-sm">
                        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#938da0]">
                            Votes
                        </p>

                        <p className="mt-2 text-3xl font-black">
                            {fanPage.vote_count}
                        </p>

                        <p className="mt-1 text-sm text-[#777286]">
                            Verified votes cast
                        </p>
                    </div>
                </section>

                {/* Tribes */}
                <section className="mt-8">
                    <div className="mb-4">
                        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-purple-600">
                            Part of the community
                        </p>

                        <h2 className="mt-1 text-2xl font-black tracking-tight">
                            Tribes
                        </h2>
                    </div>

                    {fanPage.tribes.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-black/[0.10] bg-white p-8 text-center">
                            <p className="font-bold">
                                No Tribes yet.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {fanPage.tribes.map((tribe) => (
                                <div
                                    key={tribe.id}
                                    className="rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-sm"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-xl">
                                            ✦
                                        </div>

                                        <div className="min-w-0">
                                            <h3 className="truncate font-black">
                                                {tribe.name}
                                            </h3>

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
                            FanWars record
                        </p>

                        <h2 className="mt-1 text-2xl font-black tracking-tight">
                            Battle History
                        </h2>
                    </div>

                    {fanPage.battle_history.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-black/[0.10] bg-white p-8 text-center">
                            <p className="font-bold">
                                No battles yet.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {fanPage.battle_history.map(
                                (battle, index) => (
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
                                                    FanWar #
                                                    {battle.battle_id}
                                                </span>
                                            </div>

                                            <h3 className="mt-2 truncate text-base font-black">
                                                {battle.battle_title}
                                            </h3>

                                            <p className="mt-1 text-sm text-[#777286]">
                                                Voted for{" "}
                                                <span className="font-extrabold text-[#171525]">
                                                    {battle.option_name}
                                                </span>
                                            </p>
                                        </div>

                                        <span className="shrink-0 text-lg font-black text-purple-600 transition group-hover:translate-x-1">
                                            →
                                        </span>
                                    </Link>
                                )
                            )}
                        </div>
                    )}
                </section>

                {/* Public identity */}
                <section className="mt-10 rounded-[28px] bg-[#171525] p-7 text-white sm:p-8">
                    <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-purple-300">
                        Fan Identity
                    </p>

                    <h2 className="mt-2 text-2xl font-black">
                        Built through participation.
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                        Your FanPage captures the Tribes you belong to and
                        the FanWars you have participated in.
                    </p>
                </section>
            </main>

            <footer className="mx-auto max-w-6xl px-5 pb-10 pt-4 text-center text-xs font-semibold text-[#9a94a5] sm:px-8">
                FanWars · Built around the passions that bring people together.
            </footer>
        </div>
    );
}