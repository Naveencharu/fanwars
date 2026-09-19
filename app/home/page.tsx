"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
    username: string;
    handler: string;
    display_name: string;
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
    const router = useRouter();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [tribes, setTribes] = useState<Tribe[]>([]);
    const [battles, setBattles] = useState<Battle[]>([]);
    const [options, setOptions] = useState<BattleOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadHome() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.replace("/login");
                return;
            }

            const [
                profileResult,
                membershipResult,
                battlesResult,
                optionsResult,
            ] = await Promise.all([
                supabase
                    .from("profiles")
                    .select("username, handler, display_name")
                    .eq("id", user.id)
                    .single(),

                supabase
                    .from("tribe_members")
                    .select("tribe_id")
                    .eq("user_id", user.id),

                supabase
                    .from("battles")
                    .select("id, title, description, category, status")
                    .eq("status", "live")
                    .order("created_at", { ascending: false }),

                supabase
                    .from("battle_options")
                    .select("id, battle_id, name, position")
                    .order("position"),
            ]);

            if (profileResult.error) {
                setError(profileResult.error.message);
                setLoading(false);
                return;
            }

            if (membershipResult.error) {
                setError(membershipResult.error.message);
                setLoading(false);
                return;
            }

            if (battlesResult.error) {
                setError(battlesResult.error.message);
                setLoading(false);
                return;
            }

            if (optionsResult.error) {
                setError(optionsResult.error.message);
                setLoading(false);
                return;
            }

            setProfile(profileResult.data);

            const tribeIds =
                membershipResult.data?.map((membership) => membership.tribe_id) ?? [];

            if (tribeIds.length > 0) {
                const { data: tribeData, error: tribeError } = await supabase
                    .from("tribes")
                    .select("id, name, description")
                    .in("id", tribeIds);

                if (tribeError) {
                    setError(tribeError.message);
                    setLoading(false);
                    return;
                }

                setTribes(tribeData ?? []);
            }

            setBattles(battlesResult.data ?? []);
            setOptions(optionsResult.data ?? []);
            setLoading(false);
        }

        loadHome();
    }, [router]);

    function getOptions(battleId: number) {
        return options
            .filter((option) => option.battle_id === battleId)
            .sort((a, b) => a.position - b.position);
    }

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#faf9ff]">
                <div className="text-sm font-semibold text-slate-500">
                    Loading your FanWars...
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#faf9ff] text-slate-950">
            {/* NAVIGATION */}
            <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <button
                        onClick={() => router.push("/home")}
                        className="text-xl font-black tracking-tight"
                    >
                        FAN<span className="text-violet-600">WARS</span>
                    </button>

                    <div className="hidden items-center gap-8 text-sm font-semibold text-slate-500 md:flex">
                        <button className="text-violet-600">Home</button>
                        <button onClick={() => router.push("/tribes")}>Tribes</button>
                        <button>Battles</button>
                    </div>

                    <div className="text-right">
                        <div className="text-sm font-bold">
                            {profile?.display_name}
                        </div>
                        <div className="text-xs text-slate-400">
                            @{profile?.handler}
                        </div>
                    </div>
                </div>
            </nav>

            <section className="mx-auto max-w-6xl px-6 py-10">
                {/* WELCOME */}
                <div className="rounded-3xl bg-gradient-to-br from-violet-100 via-pink-50 to-orange-50 p-8 sm:p-10">
                    <div className="max-w-2xl">
                        <div className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-violet-600">
                            Your FanWars
                        </div>

                        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                            Hey {profile?.display_name} 👋
                        </h1>

                        <p className="mt-4 text-lg text-slate-600">
                            Your passions. Your tribes. Your battles.
                        </p>

                        <p className="mt-2 text-sm text-slate-500">
                            Pick a side and make your voice count.
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* YOUR TRIBES */}
                <section className="mt-10">
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                                Your passions
                            </p>

                            <h2 className="mt-1 text-2xl font-black">
                                Your Tribes
                            </h2>
                        </div>

                        <button
                            onClick={() => router.push("/tribes")}
                            className="text-sm font-bold text-violet-600"
                        >
                            Explore tribes →
                        </button>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                        {tribes.map((tribe) => (
                            <div
                                key={tribe.id}
                                className="rounded-full border border-violet-200 bg-white px-5 py-3 text-sm font-bold shadow-sm"
                            >
                                {tribe.name}
                            </div>
                        ))}
                    </div>
                </section>

                {/* LIVE BATTLES */}
                <section className="mt-12">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
                            ⚔️ Live now
                        </p>

                        <h2 className="mt-1 text-3xl font-black">
                            Pick your battle
                        </h2>

                        <p className="mt-2 text-slate-500">
                            Every vote moves the battle.
                        </p>
                    </div>

                    {battles.length === 0 ? (
                        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-10 text-center">
                            <div className="text-4xl">⚔️</div>
                            <h3 className="mt-4 text-xl font-black">
                                No live battles yet
                            </h3>
                            <p className="mt-2 text-sm text-slate-500">
                                New FanWars are coming soon.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-6 grid gap-6 md:grid-cols-2">
                            {battles.map((battle) => {
                                const battleOptions = getOptions(battle.id);

                                return (
                                    <div
                                        key={battle.id}
                                        className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                                    >
                                        <div className="p-7">
                                            <div className="flex items-center justify-between">
                                                <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-bold text-pink-600">
                                                    ● LIVE
                                                </span>

                                                <span className="text-xs font-semibold text-slate-400">
                                                    {battle.category}
                                                </span>
                                            </div>

                                            <h3 className="mt-5 text-2xl font-black">
                                                {battle.title}
                                            </h3>

                                            <p className="mt-2 text-sm text-slate-500">
                                                {battle.description}
                                            </p>

                                            <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                                <div className="rounded-2xl bg-violet-50 p-5 text-center">
                                                    <div className="text-lg font-black">
                                                        {battleOptions[0]?.name ?? "Side A"}
                                                    </div>
                                                </div>

                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-500">
                                                    VS
                                                </div>

                                                <div className="rounded-2xl bg-orange-50 p-5 text-center">
                                                    <div className="text-lg font-black">
                                                        {battleOptions[1]?.name ?? "Side B"}
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => router.push(`/battle/${battle.id}`)}
                                                className="mt-6 w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-violet-500"
                                            >
                                                ⚔️ ENTER BATTLE →
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* SIMPLE PHASE 1 CTA */}
                <section className="mt-12 rounded-3xl border border-violet-200 bg-white p-8 text-center">
                    <div className="text-3xl">🔥</div>

                    <h2 className="mt-3 text-2xl font-black">
                        Your voice starts with one vote.
                    </h2>

                    <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
                        Join battles, support your tribe and help shape the FanWars
                        rankings.
                    </p>
                </section>
            </section>

            <footer className="border-t border-slate-200 bg-white px-6 py-8">
                <div className="mx-auto max-w-6xl text-center text-xs text-slate-400">
                    FanWars · People. Passions. Progress.
                </div>
            </footer>
        </main>
    );
}