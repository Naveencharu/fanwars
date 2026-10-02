"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppHeader from "@/components/app-header";
import BattleCover, { SidePhoto } from "@/components/battle-cover";
import ImageUpload from "@/components/image-upload";
import { supabase } from "@/lib/supabase";

type Profile = {
    id: string;
    username: string;
    handler: string;
    display_name: string;
    avatar_url: string | null;
    banner_url: string | null;
    bio: string | null;
    created_at: string;
};

type Tribe = {
    id: number;
    name: string;
    description: string | null;
    image_url: string | null;
};

type BattleHistory = {
    battle_id: number;
    battle_title: string;
    category: string;
    option_id: number;
    option_name: string;
};
type CreatedFanWar = {
    id: number;
    title: string;
    description: string | null;
    category: string;
    status: string;
    rejection_reason: string | null;
    created_at: string;
    tribe_id: number | null;
    image_url?: string | null;
};
export default function ProfilePage() {
    const router = useRouter();


    const [profile, setProfile] = useState<Profile | null>(null);
    const [tribes, setTribes] = useState<Tribe[]>([]);
    const [battleHistory, setBattleHistory] = useState<BattleHistory[]>([]);
    const [createdFanWars, setCreatedFanWars] = useState<CreatedFanWar[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {

        async function loadProfile() {

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
                    "id, username, handler, display_name, avatar_url, banner_url, bio, created_at"
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
                    .select("id, name, description, image_url")
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

            const { data: createdData, error: createdError } =
                await supabase.rpc("get_my_created_fanwars");

            if (createdError) {
                console.error("Created FanWars load failed:", createdError);
            } else {
                const rows = createdData ?? [];
                const { data: covers } = rows.length ? await supabase.from("battles")
                    .select("id, image_url").in("id", rows.map((row: CreatedFanWar) => row.id)) : { data: [] };
                setCreatedFanWars(rows.map((row: CreatedFanWar) => ({ ...row,
                    image_url: covers?.find(cover => cover.id === row.id)?.image_url ?? null,
                })));
            }

            setLoading(false);
        }

        void loadProfile();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#fcfbf8]">
                <AppHeader />

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
            <AppHeader />

            <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
                {error && (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
                        {error}
                    </div>
                )}

                {/* Profile Hero */}
                <section className="overflow-hidden rounded-[30px] border border-black/[0.06] bg-white shadow-sm">
                    {/* Cover */}
                    <div className="relative h-52 sm:h-64">
                        <ImageUpload
                            userId={profile.id}
                            folder="profile"
                            currentUrl={profile.banner_url}
                            aspect="cover"
                            label="Add cover photo"
                            className="h-full w-full"
                            onUploaded={async (url) => {
                                const { error: updateError } = await supabase
                                    .from("profiles")
                                    .update({
                                        banner_url: url,
                                    })
                                    .eq("id", profile.id);

                                if (updateError) {
                                    console.error(
                                        "Cover photo update failed:",
                                        updateError
                                    );
                                    return;
                                }

                                setProfile((current) =>
                                    current
                                        ? {
                                            ...current,
                                            banner_url: url,
                                        }
                                        : current
                                );
                            }}
                        />

                        {!profile.banner_url && (
                            <div className="pointer-events-none absolute inset-0">
                                <SidePhoto name={profile.bio || "FanWars community"} parentTopic={tribes[0]?.name} showLabel={false} sizes="(max-width: 768px) 100vw, 1024px" />
                                <span className="absolute right-4 top-4 rounded-full bg-black/50 px-4 py-2 text-xs font-bold text-white">Add your own cover photo</span>
                            </div>
                        )}
                    </div>

                    {/* Identity */}
                    <div className="px-6 pb-7 sm:px-8">
                        <div className="-mt-14 flex flex-col gap-5 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex items-end gap-5">
                                {/* Avatar */}
                                <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
                                    <ImageUpload
                                        userId={profile.id}
                                        folder="profile"
                                        currentUrl={profile.avatar_url}
                                        aspect="square"
                                        label="Add photo"
                                        className="h-full w-full rounded-full border-4 border-white bg-gradient-to-br from-brand-500 to-rose-500 shadow-xl"
                                        onUploaded={async (url) => {
                                            const { error: updateError } =
                                                await supabase
                                                    .from("profiles")
                                                    .update({
                                                        avatar_url: url,
                                                    })
                                                    .eq("id", profile.id);

                                            if (updateError) {
                                                console.error(
                                                    "Profile photo update failed:",
                                                    updateError
                                                );
                                                return;
                                            }

                                            setProfile((current) =>
                                                current
                                                    ? {
                                                        ...current,
                                                        avatar_url: url,
                                                    }
                                                    : current
                                            );
                                        }}
                                    />
                                </div>

                                {/* Identity text */}
                                <div className="pb-1">
                                    <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                                        {profile.display_name}
                                    </h1>

                                    <p className="mt-1 text-sm font-semibold text-[#777286]">
                                        @{profile.handler}
                                    </p>

                                    {profile.bio && (
                                        <p className="mt-2 max-w-xl text-sm leading-6 text-[#686577]">
                                            {profile.bio}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <Link
                                href={`/u/${profile.handler}`}
                                className="inline-flex shrink-0 rounded-full bg-[#171525] px-5 py-2.5 text-sm font-extrabold text-white transition hover:opacity-90"
                            >
                                View Public FanPage →
                            </Link>
                        </div>

                        {/* Profile metadata */}
                        <div className="mt-6 flex flex-wrap gap-2">
                            <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">
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
                            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-600">
                                Your communities
                            </p>

                            <h2 className="mt-1 text-2xl font-black tracking-tight">
                                Your Tribes
                            </h2>
                        </div>

                        <Link
                            href="/tribes"
                            className="text-sm font-extrabold text-brand-600 hover:text-brand-700"
                        >
                            Manage Tribes →
                        </Link>
                    </div>

                    {tribes.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-black/[0.10] bg-white p-8 text-center">
                            <p className="font-bold">You haven&apos;t joined a Tribe yet.</p>

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
                                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-brand-50">
                                            <SidePhoto name={tribe.name} description={tribe.description} image={tribe.image_url} showLabel={false} sizes="48px" />
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
                    <div className="mb-4 flex items-end justify-between gap-4">
                        <div>
                            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-600">
                                Your creations
                            </p>

                            <h2 className="mt-1 text-2xl font-black tracking-tight">
                                Created FanWars
                            </h2>
                        </div>

                        <Link
                            href="/create-fanwar"
                            className="text-sm font-extrabold text-brand-600 hover:text-brand-700"
                        >
                            Create FanWar →
                        </Link>
                    </div>

                    {createdFanWars.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-black/[0.10] bg-white p-8 text-center">
                            <h3 className="text-lg font-black">
                                No FanWars created yet
                            </h3>

                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#777286]">
                                Create a FanWar and build your first community battle.
                            </p>

                            <Link
                                href="/create-fanwar"
                                className="mt-5 inline-flex rounded-full bg-[#171525] px-5 py-2.5 text-sm font-extrabold text-white"
                            >
                                Create FanWar
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {createdFanWars.map((fanWar) => {
                                const statusLabel =
                                    fanWar.status === "pending"
                                        ? "Under Review"
                                        : fanWar.status === "live"
                                            ? "Live"
                                            : fanWar.status === "rejected"
                                                ? "Rejected"
                                                : fanWar.status;

                                const statusClass =
                                    fanWar.status === "pending"
                                        ? "bg-amber-50 text-amber-700"
                                        : fanWar.status === "live"
                                            ? "bg-green-50 text-green-700"
                                            : fanWar.status === "rejected"
                                                ? "bg-red-50 text-red-700"
                                                : "bg-black/[0.05] text-[#686577]";

                                const content = (
                                    <div
                                        className={`rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-sm ${fanWar.status === "live"
                                            ? "transition hover:-translate-y-0.5 hover:shadow-md"
                                            : ""
                                            }`}
                                    >
                                        <div className="mb-4 overflow-hidden rounded-2xl"><BattleCover title={fanWar.title} imageUrl={fanWar.image_url ?? null} parentTopic={fanWar.category} compact /></div>
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-brand-700">
                                                        {fanWar.category}
                                                    </span>

                                                    <span
                                                        className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${statusClass}`}
                                                    >
                                                        {statusLabel}
                                                    </span>

                                                    <span className="text-xs font-semibold text-[#9993a3]">
                                                        FanWar #{fanWar.id}
                                                    </span>
                                                </div>

                                                <h3 className="mt-2 text-base font-black">
                                                    {fanWar.title}
                                                </h3>

                                                <p className="mt-1 text-xs text-[#9993a3]">
                                                    Created{" "}
                                                    {new Date(
                                                        fanWar.created_at
                                                    ).toLocaleDateString(undefined, {
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric",
                                                    })}
                                                </p>

                                                {fanWar.status === "pending" && (
                                                    <p className="mt-3 text-sm leading-6 text-[#777286]">
                                                        Your FanWar is under moderation review and
                                                        will become visible after approval.
                                                    </p>
                                                )}

                                                {fanWar.status === "rejected" &&
                                                    fanWar.rejection_reason && (
                                                        <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3">
                                                            <p className="text-xs font-extrabold uppercase tracking-wider text-red-600">
                                                                Rejection reason
                                                            </p>

                                                            <p className="mt-1 text-sm leading-5 text-red-800">
                                                                {fanWar.rejection_reason}
                                                            </p>
                                                        </div>
                                                    )}
                                            </div>

                                            {fanWar.status === "live" && (
                                                <span className="shrink-0 text-lg font-black text-brand-600">
                                                    →
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );

                                return fanWar.status === "live" ? (
                                    <Link
                                        key={fanWar.id}
                                        href={`/battle/${fanWar.id}`}
                                    >
                                        {content}
                                    </Link>
                                ) : (
                                    <div key={fanWar.id}>
                                        {content}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Bottom navigation */}
                <section className="mt-10 rounded-[28px] bg-[#171525] p-7 text-white sm:p-8">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-300">
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
