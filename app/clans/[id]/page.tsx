"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import AppHeader from "@/components/app-header";
import BattleCover, { SidePhoto } from "@/components/battle-cover";
import { supabase } from "@/lib/supabase";
import { loadVoteCounts } from "@/lib/battle-results";

type Clan = {
    id: number;
    tribe_id: number;
    name: string;
    description: string | null;
    image_url: string | null;
    created_by: string;
    status: string;
    created_at: string;
};

type Tribe = {
    id: number;
    name: string;
};

type ClanMember = {
    user_id: string;
    role: "member" | "captain";
    joined_at: string;
    display_name: string;
    handler: string;
    avatar_url: string | null;
};
type ClanFanWar = {
    id: number;
    title: string;
    description: string | null;
    status: string;
    image_url: string | null;
    created_at: string;
    option_id: number;
    option_text: string;
    opponent_option_id: number | null;
    opponent_clan_id: number | null;
    opponent_clan_name: string | null;
    clan_votes: number;
    opponent_votes: number;
    total_votes: number;
};
export default function ClanDetailPage() {
    const params = useParams<{ id: string }>();
    const clanId = Number(params.id);

    const [clan, setClan] = useState<Clan | null>(null);
    const [tribe, setTribe] = useState<Tribe | null>(null);
    const [members, setMembers] = useState<ClanMember[]>([]);
    const [fanWars, setFanWars] = useState<ClanFanWar[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isMember, setIsMember] = useState(false);
    const [isCaptain, setIsCaptain] = useState(false);

    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!clanId || Number.isNaN(clanId)) return;

        async function loadClan() {
            setLoading(true);
            setError("");

            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                setCurrentUserId(user?.id ?? null);

                const { data: clanData, error: clanError } =
                    await supabase
                        .from("clans")
                        .select(`
                            id,
                            tribe_id,
                            name,
                            description,
                            image_url,
                            created_by,
                            status,
                            created_at
                        `)
                        .eq("id", clanId)
                        .eq("status", "active")
                        .maybeSingle();

                if (clanError) throw clanError;

                if (!clanData) {
                    setError("Clan not found.");
                    return;
                }

                setClan(clanData);

                const { data: tribeData, error: tribeError } =
                    await supabase
                        .from("tribes")
                        .select("id, name")
                        .eq("id", clanData.tribe_id)
                        .maybeSingle();

                if (tribeError) throw tribeError;

                setTribe(tribeData);
                // Load FanWars involving this Clan
                const {
                    data: clanOptionRows,
                    error: clanOptionsError,
                } = await supabase
                    .from("battle_options")
                    .select("id, battle_id, name")
                    .eq("clan_id", clanId);

                if (clanOptionsError) throw clanOptionsError;

                const clanOptions = clanOptionRows ?? [];

                if (clanOptions.length === 0) {
                    setFanWars([]);
                } else {
                    const battleIds = [
                        ...new Set(
                            clanOptions.map((option) => option.battle_id)
                        ),
                    ];

                    const {
                        data: battleRows,
                        error: battlesError,
                    } = await supabase
                        .from("battles")
                        .select(`
            id,
            title,
            description,
            status,
            image_url,
            created_at
        `)
                        .in("id", battleIds)
                        .order("created_at", { ascending: false });

                    if (battlesError) throw battlesError;

                    const {
                        data: allBattleOptions,
                        error: allOptionsError,
                    } = await supabase
                        .from("battle_options")
                        .select(`
            id,
            battle_id,
            name,
            clan_id
        `)
                        .in("battle_id", battleIds);

                    if (allOptionsError) throw allOptionsError;
                    const voteCountMap = await loadVoteCounts(
                        supabase, (battleRows ?? []).map((battle) => battle.id)
                    );

                    const opponentClanIds = [
                        ...new Set(
                            (allBattleOptions ?? [])
                                .filter(
                                    (option) =>
                                        option.clan_id &&
                                        option.clan_id !== clanId
                                )
                                .map(
                                    (option) =>
                                        option.clan_id as number
                                )
                        ),
                    ];

                    let opponentClanMap = new Map<number, string>();

                    if (opponentClanIds.length > 0) {
                        const {
                            data: opponentClans,
                            error: opponentClansError,
                        } = await supabase
                            .from("clans")
                            .select("id, name")
                            .in("id", opponentClanIds);

                        if (opponentClansError) {
                            throw opponentClansError;
                        }

                        opponentClanMap = new Map(
                            (opponentClans ?? []).map(
                                (opponentClan) => [
                                    opponentClan.id,
                                    opponentClan.name,
                                ]
                            )
                        );
                    }

                    const clanOptionMap = new Map(
                        clanOptions.map((option) => [
                            option.battle_id,
                            option,
                        ])
                    );

                    const enrichedFanWars: ClanFanWar[] =
                        (battleRows ?? []).map((battle) => {
                            const ownOption =
                                clanOptionMap.get(battle.id);

                            const opponentOption =
                                (allBattleOptions ?? []).find(
                                    (option) =>
                                        option.battle_id === battle.id &&
                                        option.clan_id &&
                                        option.clan_id !== clanId
                                );
                            const clanVotes = ownOption
                                ? voteCountMap.get(ownOption.id) ?? 0
                                : 0;

                            const opponentVotes = opponentOption
                                ? voteCountMap.get(opponentOption.id) ?? 0
                                : 0;

                            const totalVotes = clanVotes + opponentVotes;
                            return {
                                id: battle.id,
                                title: battle.title,
                                description: battle.description,
                                status: battle.status,
                                image_url: battle.image_url,
                                created_at: battle.created_at,
                                option_id: ownOption?.id ?? 0,
                                option_text:
                                    ownOption?.name ??
                                    clanData.name,
                                opponent_option_id:
                                    opponentOption?.id ?? null,
                                opponent_clan_id:
                                    opponentOption?.clan_id ?? null,
                                opponent_clan_name:
                                    opponentOption?.clan_id
                                        ? opponentClanMap.get(
                                            opponentOption.clan_id
                                        ) ??
                                        opponentOption.name
                                        : null,
                                clan_votes: clanVotes,
                                opponent_votes: opponentVotes,
                                total_votes: totalVotes,
                            };
                        });

                    setFanWars(enrichedFanWars);
                }
                const { data: membershipRows, error: membershipError } =
                    await supabase
                        .from("clan_members")
                        .select(`
                            user_id,
                            role,
                            joined_at
                        `)
                        .eq("clan_id", clanId)
                        .order("joined_at", { ascending: true });

                if (membershipError) throw membershipError;

                const rawMemberships = membershipRows ?? [];

                if (user) {
                    const ownMembership = rawMemberships.find(
                        (membership) => membership.user_id === user.id
                    );

                    setIsMember(!!ownMembership);
                    setIsCaptain(ownMembership?.role === "captain");
                } else {
                    setIsMember(false);
                    setIsCaptain(false);
                }

                const userIds = rawMemberships.map(
                    (membership) => membership.user_id
                );

                if (userIds.length === 0) {
                    setMembers([]);
                    return;
                }

                const { data: profiles, error: profilesError } =
                    await supabase
                        .from("profiles")
                        .select(`
                            id,
                            display_name,
                            handler,
                            avatar_url
                        `)
                        .in("id", userIds);

                if (profilesError) throw profilesError;

                const profileMap = new Map(
                    (profiles ?? []).map((profile) => [
                        profile.id,
                        profile,
                    ])
                );

                const enrichedMembers: ClanMember[] =
                    rawMemberships
                        .map((membership) => {
                            const profile = profileMap.get(
                                membership.user_id
                            );

                            if (!profile) return null;

                            return {
                                user_id: membership.user_id,
                                role: membership.role as
                                    | "member"
                                    | "captain",
                                joined_at: membership.joined_at,
                                display_name:
                                    profile.display_name ||
                                    profile.handler,
                                handler: profile.handler,
                                avatar_url: profile.avatar_url,
                            };
                        })
                        .filter(
                            (
                                member
                            ): member is ClanMember => member !== null
                        );

                enrichedMembers.sort((a, b) => {
                    if (
                        a.role === "captain" &&
                        b.role !== "captain"
                    ) {
                        return -1;
                    }

                    if (
                        b.role === "captain" &&
                        a.role !== "captain"
                    ) {
                        return 1;
                    }

                    return (
                        new Date(a.joined_at).getTime() -
                        new Date(b.joined_at).getTime()
                    );
                });

                setMembers(enrichedMembers);
            } catch (err) {
                console.error(
                    "Clan page error FULL:",
                    JSON.stringify(err, null, 2)
                );

                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load this Clan."
                );
            } finally {
                setLoading(false);
            }
        }

        loadClan();
    }, [clanId]);

    async function handleJoinClan() {
        if (!clan || joining || isMember) return;

        setJoining(true);
        setError("");

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                window.location.href = `/login?redirect=${encodeURIComponent(
                    `/clans/${clan.id}`
                )}`;

                return;
            }

            const { error: joinError } = await supabase.rpc(
                "join_clan",
                {
                    p_clan_id: clan.id,
                }
            );

            if (joinError) {
                setError(joinError.message || "Unable to join this Clan.");
                return;
            }

            window.location.reload();
        } catch (err) {
            console.error("Join Clan error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to join this Clan."
            );
        } finally {
            setJoining(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-[#fcfbf8]">
                <AppHeader />

                <div className="mx-auto max-w-5xl px-5 py-12">
                    <div className="h-5 w-40 animate-pulse rounded bg-black/5" />

                    <div className="mt-5 h-64 animate-pulse rounded-[2rem] bg-black/5" />

                    <div className="mt-8 h-48 animate-pulse rounded-3xl bg-black/5" />
                </div>
            </main>
        );
    }

    if (error && !clan) {
        return (
            <main className="min-h-screen bg-[#fcfbf8]">
                <AppHeader />

                <div className="mx-auto max-w-5xl px-5 py-16 text-center">
                    <div className="text-4xl">🛡️</div>

                    <h1 className="mt-4 text-2xl font-black text-[#171525]">
                        Clan not found
                    </h1>

                    <p className="mt-2 text-sm text-[#686577]">
                        {error || "This Clan does not exist."}
                    </p>

                    <Link
                        href="/tribes"
                        className="mt-6 inline-flex rounded-full bg-[#171525] px-5 py-3 text-sm font-extrabold text-white"
                    >
                        Back to Tribes
                    </Link>
                </div>
            </main>
        );
    }

    if (!clan) return null;

    const captain = members.find(
        (member) => member.role === "captain"
    );
    const closedFanWars = fanWars.filter(
        (fanWar) => fanWar.status === "closed"
    );

    const played = closedFanWars.length;

    const wins = closedFanWars.filter(
        (fanWar) => fanWar.clan_votes > fanWar.opponent_votes
    ).length;

    const losses = closedFanWars.filter(
        (fanWar) => fanWar.clan_votes < fanWar.opponent_votes
    ).length;

    const draws = closedFanWars.filter(
        (fanWar) => fanWar.clan_votes === fanWar.opponent_votes
    ).length;

    return (
        <main className="min-h-screen bg-[#fcfbf8]">
            <AppHeader />

            <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
                {tribe && (
                    <Link
                        href={`/tribes/${tribe.id}`}
                        className="text-sm font-bold text-[#686577] transition hover:text-[#171525]"
                    >
                        ← Back to {tribe.name}
                    </Link>
                )}

                {/* Clan Hero */}
                <section className="mt-5 overflow-hidden rounded-[2rem] border border-black/[0.06] bg-white shadow-sm">
                    <div className="relative isolate overflow-hidden px-6 py-10 sm:px-10 sm:py-12">
                        <div className="absolute inset-0 -z-10">
                            <SidePhoto name={clan.name} description={clan.description} parentTopic={tribe?.name} image={clan.image_url} showLabel={false} sizes="(max-width: 1024px) 100vw, 1024px" />
                            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/15" />
                        </div>
                        <div className="flex min-h-48 flex-col justify-end gap-7 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex items-center gap-5">

                                <div>
                                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/80">
                                        {tribe
                                            ? `${tribe.name} Clan`
                                            : "FanWars Clan"}
                                    </p>

                                    <h1 className="mt-2 text-3xl font-black tracking-tight text-white drop-shadow-lg sm:text-4xl">
                                        {clan.name}
                                    </h1>

                                    {clan.description && (
                                        <p className="mt-3 max-w-xl text-sm leading-6 text-white/90">
                                            {clan.description}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {isCaptain ? (
                                <div className="rounded-full bg-amber-100 px-5 py-3 text-sm font-extrabold text-amber-800">
                                    👑 Captain
                                </div>
                            ) : isMember ? (
                                <div className="rounded-full bg-brand-100 px-5 py-3 text-sm font-extrabold text-brand-700">
                                    ✓ Joined
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleJoinClan}
                                    disabled={joining}
                                    className="rounded-full bg-[#171525] px-6 py-3 text-sm font-extrabold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {joining
                                        ? "Joining..."
                                        : "Join Clan"}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Clan Stats */}
                    {/* Clan Stats */}
                    <div className="grid grid-cols-2 border-t border-black/[0.06] sm:grid-cols-5">

                        <div className="px-4 py-5 text-center">
                            <p className="text-2xl font-black text-[#171525]">
                                {members.length}
                            </p>
                            <p className="mt-1 text-xs font-bold text-[#888393]">
                                Members
                            </p>
                        </div>

                        <div className="border-l border-black/[0.06] px-4 py-5 text-center">
                            <p className="text-2xl font-black text-[#171525]">
                                {played}
                            </p>
                            <p className="mt-1 text-xs font-bold text-[#888393]">
                                Played
                            </p>
                        </div>

                        <div className="border-t border-black/[0.06] px-4 py-5 text-center sm:border-l sm:border-t-0">
                            <p className="text-2xl font-black text-green-600">
                                {wins}
                            </p>
                            <p className="mt-1 text-xs font-bold text-[#888393]">
                                Won
                            </p>
                        </div>

                        <div className="border-l border-t border-black/[0.06] px-4 py-5 text-center sm:border-t-0">
                            <p className="text-2xl font-black text-red-600">
                                {losses}
                            </p>
                            <p className="mt-1 text-xs font-bold text-[#888393]">
                                Lost
                            </p>
                        </div>

                        <div className="col-span-2 border-t border-black/[0.06] px-4 py-5 text-center sm:col-span-1 sm:border-l sm:border-t-0">
                            <p className="text-2xl font-black text-amber-600">
                                {draws}
                            </p>
                            <p className="mt-1 text-xs font-bold text-[#888393]">
                                Draw
                            </p>
                        </div>

                    </div>
                </section>

                {error && (
                    <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                        {error}
                        {error === "Join the Tribe before joining this Clan" && (
                            <Link href={`/tribes/${clan.tribe_id}`} className="ml-2 underline">
                                Join {tribe?.name ?? "the Tribe"}
                            </Link>
                        )}
                    </div>
                )}

                {/* Captain */}
                <section className="mt-8">
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-600">
                        Leadership
                    </p>

                    <h2 className="mt-1 text-2xl font-black text-[#171525]">
                        Clan Captain
                    </h2>

                    {captain ? (
                        <Link
                            href={`/u/${captain.handler}`}
                            className="mt-4 flex max-w-md items-center gap-4 rounded-3xl border border-black/[0.06] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-100 text-lg font-black text-amber-800">
                                {captain.avatar_url ? (
                                    <img
                                        src={captain.avatar_url}
                                        alt=""
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    captain.display_name
                                        .charAt(0)
                                        .toUpperCase()
                                )}
                            </div>

                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="truncate font-black text-[#171525]">
                                        {captain.display_name}
                                    </p>

                                    <span className="text-sm">👑</span>
                                </div>

                                <p className="mt-1 truncate text-sm font-semibold text-[#888393]">
                                    @{captain.handler}
                                </p>

                                <p className="mt-2 text-xs font-extrabold text-amber-700">
                                    Founding Captain
                                </p>
                            </div>
                        </Link>
                    ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white p-6">
                            <p className="text-sm font-bold text-[#686577]">
                                Captain information unavailable.
                            </p>
                        </div>
                    )}
                </section>

                {/* Members */}
                <section className="mt-8">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-600">
                                Community
                            </p>

                            <h2 className="mt-1 text-2xl font-black text-[#171525]">
                                Clan Members
                            </h2>
                        </div>

                        <span className="text-sm font-bold text-[#888393]">
                            {members.length} total
                        </span>
                    </div>

                    {members.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white p-8 text-center">
                            <p className="font-bold text-[#686577]">
                                No members yet.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {members.map((member) => (
                                <Link
                                    key={member.user_id}
                                    href={`/u/${member.handler}`}
                                    className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-sm"
                                >
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-black text-brand-700">
                                        {member.avatar_url ? (
                                            <img
                                                src={
                                                    member.avatar_url
                                                }
                                                alt=""
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            member.display_name
                                                .charAt(0)
                                                .toUpperCase()
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate text-sm font-extrabold text-[#171525]">
                                                {
                                                    member.display_name
                                                }
                                            </p>

                                            {member.role ===
                                                "captain" && (
                                                    <span
                                                        title="Clan Captain"
                                                        className="text-xs"
                                                    >
                                                        👑
                                                    </span>
                                                )}
                                        </div>

                                        <p className="truncate text-xs font-semibold text-[#888393]">
                                            @{member.handler}
                                        </p>
                                    </div>

                                    {member.role === "captain" && (
                                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-amber-700">
                                            Captain
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                {/* Clan FanWars */}
                <section className="mt-8">
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-600">
                        Competition
                    </p>

                    <h2 className="mt-1 text-2xl font-black text-[#171525]">
                        Clan FanWars
                    </h2>

                    {fanWars.length === 0 ? (
                        <div className="mt-4 rounded-3xl border border-dashed border-black/10 bg-white p-8 text-center">
                            <div className="text-3xl">⚔️</div>

                            <h3 className="mt-3 text-lg font-black text-[#171525]">
                                No Clan FanWars yet
                            </h3>

                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#686577]">
                                Clan battles involving this Clan will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-4 grid gap-4">
                            {fanWars.map((fanWar) => (
                                <Link
                                    key={fanWar.id}
                                    href={`/battle/${fanWar.id}`}
                                    className="overflow-hidden rounded-3xl border border-black/[0.06] bg-white transition hover:-translate-y-0.5 hover:shadow-md"
                                >
                                    <BattleCover title={fanWar.title} imageUrl={fanWar.image_url} optionNames={fanWar.opponent_clan_name ? [fanWar.option_text, fanWar.opponent_clan_name] : []} parentTopic={tribe?.name} compact />

                                    <div className="p-5 sm:p-6">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span
                                                className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${fanWar.status === "live"
                                                    ? "bg-green-50 text-green-700"
                                                    : fanWar.status === "pending"
                                                        ? "bg-amber-50 text-amber-700"
                                                        : "bg-black/5 text-[#686577]"
                                                    }`}
                                            >
                                                {fanWar.status === "closed"
                                                    ? fanWar.clan_votes > fanWar.opponent_votes
                                                        ? "WON"
                                                        : fanWar.clan_votes < fanWar.opponent_votes
                                                            ? "LOST"
                                                            : "DRAW"
                                                    : fanWar.status}
                                            </span>

                                            <span className="text-xs font-bold text-[#888393]">
                                                Clan FanWar
                                            </span>
                                        </div>

                                        <h3 className="mt-3 text-xl font-black text-[#171525]">
                                            {fanWar.title}
                                        </h3>

                                        {fanWar.description && (
                                            <p className="mt-2 text-sm leading-6 text-[#686577]">
                                                {fanWar.description}
                                            </p>
                                        )}

                                        <div className="mt-5 flex items-center gap-3">
                                            <div className="flex-1 rounded-2xl bg-brand-50 px-4 py-3 text-center">
                                                <p className="text-xs font-bold text-[#888393]">
                                                    This Clan
                                                </p>

                                                <p className="mt-1 font-black text-brand-700">
                                                    {fanWar.option_text}
                                                </p>
                                                <p className="mt-2 text-xs font-bold text-[#686577]">
                                                    {fanWar.clan_votes}{" "}
                                                    {fanWar.clan_votes === 1 ? "vote" : "votes"}
                                                </p>

                                                <p className="mt-1 text-lg font-black text-brand-700">
                                                    {fanWar.total_votes > 0
                                                        ? Math.round(
                                                            (fanWar.clan_votes / fanWar.total_votes) * 100
                                                        )
                                                        : 0}
                                                    %
                                                </p>
                                            </div>

                                            <span className="text-xs font-black text-[#888393]">
                                                VS
                                            </span>

                                            <div className="flex-1 rounded-2xl bg-black/[0.03] px-4 py-3 text-center">
                                                <p className="text-xs font-bold text-[#888393]">
                                                    Opponent
                                                </p>

                                                <p className="mt-1 font-black text-[#171525]">
                                                    {fanWar.opponent_clan_name ||
                                                        "Opponent"}
                                                </p>
                                                <p className="mt-2 text-xs font-bold text-[#686577]">
                                                    {fanWar.opponent_votes}{" "}
                                                    {fanWar.opponent_votes === 1 ? "vote" : "votes"}
                                                </p>

                                                <p className="mt-1 text-lg font-black text-[#171525]">
                                                    {fanWar.total_votes > 0
                                                        ? Math.round(
                                                            (fanWar.opponent_votes /
                                                                fanWar.total_votes) *
                                                            100
                                                        )
                                                        : 0}
                                                    %
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-5 flex items-center justify-between gap-4">
                                            <span className="text-xs font-bold text-[#888393]">
                                                {fanWar.total_votes} total{" "}
                                                {fanWar.total_votes === 1 ? "vote" : "votes"}
                                            </span>

                                            <span className="text-sm font-extrabold text-brand-600">
                                                View FanWar →
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

            </div>
        </main>
    );
}
