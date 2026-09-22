"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import FanWarsLogo, {
  FanWarsMark,
} from "@/components/fanwars-logo";

import { supabase } from "@/lib/supabase";


/* =========================================================
   TYPES
   ========================================================= */

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

type BattleResult = {
  option_id: number;
  option_name: string;
  vote_count: number;
};


/* =========================================================
   PAGE
   ========================================================= */

export default function HomePage() {

  const [battle, setBattle] = useState<Battle | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [handler, setHandler] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  const [options, setOptions] = useState<BattleOption[]>([]);

  const [results, setResults] = useState<BattleResult[]>([]);

  const [loadingBattle, setLoadingBattle] = useState(true);

  useEffect(() => {
    loadFeaturedBattle();
    loadCurrentUser();
  }, []);

  async function loadCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    setLoggedIn(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, handler")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      setDisplayName(profile.display_name);
      setHandler(profile.handler);
    }
  }
  /* =======================================================
     LOAD REAL FEATURED BATTLE
     ======================================================= */

  async function loadFeaturedBattle() {

    setLoadingBattle(true);

    try {

      /*
       * Battle #1 is our current featured FanWar.
       */

      const {
        data: battleData,
        error: battleError,
      } = await supabase
        .from("battles")
        .select(
          "id, title, description, category, status"
        )
        .eq("id", 1)
        .eq("status", "live")
        .single();


      if (battleError) {
        console.error("Battle load error:", battleError);
        return;
      }


      /*
       * Load the two real battle options.
       */

      const {
        data: optionData,
        error: optionError,
      } = await supabase
        .from("battle_options")
        .select(
          "id, battle_id, name, position"
        )
        .eq("battle_id", 1)
        .order("position", {
          ascending: true,
        });


      if (optionError) {
        console.error("Option load error:", optionError);
        return;
      }


      /*
       * Load real aggregated vote counts.
       */

      const {
        data: resultData,
        error: resultError,
      } = await supabase.rpc(
        "get_battle_results",
        {
          p_battle_id: 1,
        }
      );


      if (resultError) {
        console.error("Results load error:", resultError);
        return;
      }


      setBattle(battleData);

      setOptions(optionData ?? []);

      setResults(resultData ?? []);

    } catch (error) {

      console.error(
        "Unexpected battle error:",
        error
      );

    } finally {

      setLoadingBattle(false);

    }
  }


  return (
    <main className="min-h-screen bg-[#fcfbf8] text-[#171525]">


      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="sticky top-0 z-50 border-b border-purple-100/60 bg-[#fcfbf8]/90 backdrop-blur-xl">

        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">

          <FanWarsLogo />


          <nav className="hidden items-center gap-8 text-sm font-bold text-[#6f687b] md:flex">

            <a
              href="#battles"
              className="transition hover:text-purple-600"
            >
              FanWars
            </a>

            <a
              href="#tribes"
              className="transition hover:text-purple-600"
            >
              Tribes
            </a>

            <a
              href="#how-it-works"
              className="transition hover:text-purple-600"
            >
              How it works
            </a>

            <Link
              href="/create-fanwar"
              className="transition hover:text-purple-600"
            >
              Create FanWar
            </Link>

          </nav>


          <div className="flex items-center gap-2 sm:gap-3">

            {loggedIn ? (
              <Link
                href="/profile"
                className="rounded-full border border-purple-100 bg-white px-4 py-2 text-xs font-extrabold shadow-sm"
              >
                {displayName || "My Profile"}
                {handler && (
                  <span className="ml-2 text-[10px] text-[#81798e]">
                    @{handler}
                  </span>
                )}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden px-3 py-2 text-sm font-bold text-[#625b70] transition hover:text-purple-600 sm:block"
                >
                  Log in
                </Link>

                <Link
                  href="/signup"
                  className="rounded-full bg-[#171525] px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:px-5 sm:text-sm"
                >
                  Join FanWars
                </Link>
              </>
            )}

          </div>

        </div>

      </header>


      {/* ===================================================
          HERO
      =================================================== */}

      <section className="relative overflow-hidden">

        <div className="pointer-events-none absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-purple-200/35 blur-3xl" />

        <div className="pointer-events-none absolute -right-40 top-0 h-[550px] w-[550px] rounded-full bg-pink-200/35 blur-3xl" />

        <div className="pointer-events-none absolute left-1/2 top-[500px] h-[350px] w-[350px] -translate-x-1/2 rounded-full bg-blue-100/30 blur-3xl" />


        <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8">

          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">


            {/* HERO COPY */}

            <div className="max-w-2xl">

              <div className="inline-flex items-center gap-2 rounded-full border border-purple-100 bg-white/80 px-4 py-2 text-xs font-extrabold text-purple-700 shadow-sm">

                <span className="h-2 w-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />

                Where passions go head-to-head

              </div>


              <h1 className="mt-7 text-5xl font-black leading-[0.98] tracking-[-0.065em] sm:text-6xl lg:text-[76px]">

                Your passion.
                <br />

                <span className="bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
                  Your side.
                </span>

                <br />

                Your FanWar.

              </h1>


              <p className="mt-7 max-w-xl text-base leading-7 text-[#756e80] sm:text-lg">

                Choose your tribe, take your side, and rally the people
                who feel the same. Every FanWar is a chance to make your
                passion count.

              </p>


              <div className="mt-8 flex flex-col gap-3 sm:flex-row">

                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-full bg-[#171525] px-7 py-4 text-sm font-extrabold text-white shadow-lg shadow-purple-200/40 transition hover:-translate-y-0.5 hover:shadow-xl"
                >
                  Join the movement
                  <span className="ml-2">→</span>
                </Link>


                <a
                  href="#battles"
                  className="inline-flex items-center justify-center rounded-full border border-purple-100 bg-white px-7 py-4 text-sm font-extrabold text-[#171525] shadow-sm transition hover:bg-purple-50"
                >
                  Explore FanWars
                </a>

              </div>


              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-bold text-[#928a9d]">

                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  Live battles
                </span>

                <span className="flex items-center gap-2">
                  <FanWarsMark className="h-4 w-4 text-purple-600" />
                  1 person = 1 vote
                </span>

                <span>
                  Built for fans
                </span>

              </div>

            </div>


            {/* FEATURED BATTLE */}

            <div
              id="battles"
              className="relative"
            >

              <div className="absolute -right-2 -top-5 z-10 hidden rounded-full bg-white px-4 py-2 text-xs font-extrabold text-purple-700 shadow-lg sm:block">
                ⚡ Happening now
              </div>


              {loadingBattle ? (
                <LoadingBattleCard />
              ) : battle && options.length >= 2 ? (
                <FeaturedBattleCard
                  battle={battle}
                  options={options}
                  results={results}
                />
              ) : (
                <EmptyBattleCard />
              )}

            </div>

          </div>

        </div>

      </section>


      {/* ===================================================
          STATS
      =================================================== */}

      <section className="border-y border-purple-100/70 bg-white">

        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-purple-100/70 px-5 sm:grid-cols-4 sm:px-6 lg:px-8">

          <Stat
            value="12"
            label="Tribes"
          />

          <Stat
            value="4"
            label="Live FanWars"
          />

          <Stat
            value="1"
            label="Vote per person"
          />

          <Stat
            value="∞"
            label="Passions to rally"
          />

        </div>

      </section>


      {/* ===================================================
          TRENDING
      =================================================== */}

      <section className="bg-[#fcfbf8] px-5 py-20 sm:px-6 lg:px-8">

        <div className="mx-auto max-w-7xl">

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

            <div>

              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-purple-500">
                Pick your battle
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                What are you backing?
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-[#81798e]">
                Find a side. Make your choice. See where the community stands.
              </p>

            </div>


            <Link
              href="/home"
              className="text-sm font-extrabold text-purple-600 transition hover:text-pink-500"
            >
              View all FanWars →
            </Link>

          </div>


          <div className="mt-10 grid gap-5 md:grid-cols-3">

            <BattlePreviewCard
              id={2}
              title="Cricket vs Football"
              category="Sports"
              leftName="Cricket Nation"
              rightName="Football Tribe"
            />

            <BattlePreviewCard
              id={3}
              title="Biryani vs Pizza"
              category="Food"
              leftName="Biryani Believers"
              rightName="Pizza People"
            />

            <BattlePreviewCard
              id={4}
              title="Marvel vs DC"
              category="Entertainment"
              leftName="Marvel Universe"
              rightName="DC Universe"
            />

          </div>

        </div>

      </section>


      {/* ===================================================
          TRIBES
      =================================================== */}

      <section
        id="tribes"
        className="bg-white px-5 py-20 sm:px-6 lg:px-8"
      >

        <div className="mx-auto max-w-7xl">

          <div className="text-center">

            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-pink-500">
              Find your people
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Every passion has a tribe.
            </h2>

            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#81798e]">
              From chai to cricket, mountains to Marvel — pick the things
              you care about and find people who care just as much.
            </p>

          </div>


          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">

            <TribeTile
              name="Chai Gang"
              logo={<ChaiGangLogo />}
            />

            <TribeTile
              name="Coffee Crew"
              logo={<CoffeeCrewLogo />}
            />

            <TribeTile
              name="Cricket Nation"
              logo={<CricketLogo />}
            />

            <TribeTile
              name="Football Tribe"
              logo={<FootballLogo />}
            />

            <TribeTile
              name="Marvel Universe"
              logo={<MarvelLogo />}
            />

            <TribeTile
              name="Beach Tribe"
              logo={<BeachLogo />}
            />

          </div>


          <div className="mt-8 text-center">

            <Link
              href="/tribes"
              className="inline-flex rounded-full border border-purple-100 bg-[#faf8ff] px-6 py-3 text-sm font-extrabold text-purple-700 transition hover:bg-purple-50"
            >
              Explore all tribes
            </Link>

          </div>

        </div>

      </section>


      {/* ===================================================
          HOW IT WORKS
      =================================================== */}

      <section
        id="how-it-works"
        className="bg-gradient-to-br from-[#f7efff] via-[#fff5fb] to-[#eef7ff] px-5 py-20 sm:px-6 lg:px-8"
      >

        <div className="mx-auto max-w-7xl">

          <div className="max-w-2xl">

            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-purple-500">
              The FanWars loop
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Passion becomes participation.
            </h2>

          </div>


          <div className="mt-12 grid gap-5 md:grid-cols-4">

            <HowStep
              number="01"
              title="Join a tribe"
              text="Choose the passions that feel like you."
            />

            <HowStep
              number="02"
              title="Take a side"
              text="Enter a live FanWar and make your choice."
            />

            <HowStep
              number="03"
              title="Rally your people"
              text="Share the battle and bring your tribe with you."
            />

            <HowStep
              number="04"
              title="Build your influence"
              text="Your participation becomes part of your FanWars identity."
            />

          </div>

        </div>

      </section>


      {/* ===================================================
          FINAL CTA
      =================================================== */}

      <section className="bg-[#171525] px-5 py-20 sm:px-6 lg:px-8">

        <div className="mx-auto max-w-4xl text-center">

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">

            <FanWarsMark className="h-8 w-8 text-white" />

          </div>


          <h2 className="mt-7 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
            What side are you on?
          </h2>


          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/60 sm:text-base">
            Join FanWars and turn the things you love into something you
            can rally around.
          </p>


          <Link
            href="/signup"
            className="mt-8 inline-flex rounded-full bg-white px-7 py-4 text-sm font-extrabold text-[#171525] transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            Create your FanWars identity
            <span className="ml-2">→</span>
          </Link>

        </div>

      </section>


      {/* ===================================================
          FOOTER
      =================================================== */}

      <footer className="border-t border-purple-100/70 bg-white">

        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">

          <FanWarsLogo size="sm" />

          <div className="flex flex-wrap gap-5 text-xs font-bold text-[#8b8396]">

            <Link
              href="/login"
              className="transition hover:text-purple-600"
            >
              Log in
            </Link>

            <Link
              href="/signup"
              className="transition hover:text-purple-600"
            >
              Join
            </Link>

            <span>
              People. Passions. Battles.
            </span>

          </div>

        </div>

      </footer>

    </main>
  );
}


/* =========================================================
   FEATURED BATTLE CARD
   ========================================================= */

function FeaturedBattleCard({
  battle,
  options,
  results,
}: {
  battle: Battle;
  options: BattleOption[];
  results: BattleResult[];
}) {

  const leftOption = options[0];
  const rightOption = options[1];

  const leftResult = results.find(
    (result) => result.option_id === leftOption.id
  );

  const rightResult = results.find(
    (result) => result.option_id === rightOption.id
  );

  const leftVotes = Number(
    leftResult?.vote_count ?? 0
  );

  const rightVotes = Number(
    rightResult?.vote_count ?? 0
  );

  const totalVotes = leftVotes + rightVotes;


  return (
    <div className="rounded-[2rem] border border-white bg-white p-7 shadow-[0_30px_90px_rgba(65,35,110,0.16)] sm:p-9">


      {/* TOP */}

      <div className="flex items-center justify-between">

        <span className="inline-flex items-center gap-2 rounded-full bg-pink-50 px-4 py-2 text-xs font-extrabold text-pink-600">

          <span className="h-2 w-2 rounded-full bg-pink-500" />

          LIVE

        </span>


        <span className="rounded-full bg-[#f8f6fb] px-4 py-2 text-xs font-bold text-[#81798e]">
          {battle.category}
        </span>

      </div>


      {/* TITLE */}

      <div className="mt-8">

        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#9b93a5]">
          Featured FanWar
        </p>


        <h2 className="mt-3 text-4xl font-black tracking-[-0.055em] sm:text-5xl">
          {battle.title}
        </h2>


        {battle.description && (
          <p className="mt-2 text-sm text-[#81798e]">
            {battle.description}
          </p>
        )}

      </div>


      {/* SIDES */}

      <div className="mt-10 grid grid-cols-[1fr_auto_1fr] items-center gap-3">


        {/* LEFT */}

        <div className="text-center">

          <div className="flex h-24 items-center justify-center">
            {getTribeLogo(leftOption.name)}
          </div>

          <h3 className="mt-2 text-base font-black">
            {leftOption.name}
          </h3>

        </div>


        {/* VS */}

        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-500 text-xs font-black text-white shadow-lg shadow-purple-200">
          VS
        </div>


        {/* RIGHT */}

        <div className="text-center">

          <div className="flex h-24 items-center justify-center">
            {getTribeLogo(rightOption.name)}
          </div>

          <h3 className="mt-2 text-base font-black">
            {rightOption.name}
          </h3>

        </div>

      </div>


      {/* REAL RESULTS BAR */}

      <div className="mt-7">

        {totalVotes > 0 ? (

          <>
            <div className="flex h-3 overflow-hidden rounded-full bg-[#f2edf8]">

              <div
                className="bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all duration-700"
                style={{
                  width: `${Math.round(
                    (leftVotes / totalVotes) * 100
                  )}%`,
                }}
              />

              <div
                className="bg-gradient-to-r from-pink-400 to-orange-300 transition-all duration-700"
                style={{
                  width: `${Math.round(
                    (rightVotes / totalVotes) * 100
                  )}%`,
                }}
              />

            </div>


            <div className="mt-2 flex justify-between text-xs font-bold text-[#948c9f]">

              <span>
                {leftVotes}{" "}
                {leftVotes === 1 ? "vote" : "votes"}
              </span>

              <span>
                {rightVotes}{" "}
                {rightVotes === 1 ? "vote" : "votes"}
              </span>

            </div>
          </>

        ) : (

          <>
            <div className="flex h-3 overflow-hidden rounded-full bg-[#f2edf8]">

              <div className="w-1/2 bg-gradient-to-r from-purple-500 to-fuchsia-500" />

              <div className="w-1/2 bg-gradient-to-r from-pink-400 to-orange-300" />

            </div>


            <div className="mt-2 flex justify-between text-xs font-bold text-[#948c9f]">

              <span>
                Choose your side
              </span>

              <span>
                1 person = 1 vote
              </span>

            </div>
          </>

        )}

      </div>


      {/* CTA */}

      <Link
        href={`/battle/${battle.id}`}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-[#171525] px-6 py-4 text-sm font-extrabold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-xl"
      >

        <span className="text-base">
          ⚔
        </span>

        Enter FanWar

      </Link>


      {/* FOOTER */}

      <div className="mt-6 border-t border-purple-100 pt-5 text-center">

        <p className="text-xs font-semibold text-[#a29aaa]">

          {totalVotes > 0
            ? `${totalVotes} ${totalVotes === 1 ? "person has" : "people have"
            } voted so far.`
            : "Your vote counts. Your participation builds your influence."}

        </p>

      </div>

    </div>
  );
}


/* =========================================================
   LOADING CARD
   ========================================================= */

function LoadingBattleCard() {
  return (
    <div className="rounded-[2rem] border border-white bg-white p-9 shadow-[0_30px_90px_rgba(65,35,110,0.16)]">

      <div className="h-8 w-20 animate-pulse rounded-full bg-purple-100" />

      <div className="mt-10 h-5 w-32 animate-pulse rounded bg-purple-50" />

      <div className="mt-4 h-12 w-3/4 animate-pulse rounded-xl bg-purple-50" />

      <div className="mt-10 flex justify-between">

        <div className="h-24 w-24 animate-pulse rounded-3xl bg-purple-50" />

        <div className="h-12 w-12 animate-pulse rounded-full bg-purple-100" />

        <div className="h-24 w-24 animate-pulse rounded-3xl bg-pink-50" />

      </div>

      <div className="mt-8 h-3 animate-pulse rounded-full bg-purple-50" />

      <div className="mt-8 h-12 animate-pulse rounded-full bg-purple-50" />

    </div>
  );
}


/* =========================================================
   EMPTY CARD
   ========================================================= */

function EmptyBattleCard() {
  return (
    <div className="rounded-[2rem] border border-purple-100 bg-white p-9 text-center shadow-[0_30px_90px_rgba(65,35,110,0.12)]">

      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-50">
        <FanWarsMark className="h-8 w-8 text-purple-600" />
      </div>

      <h2 className="mt-6 text-2xl font-black">
        FanWars are coming
      </h2>

      <p className="mt-2 text-sm text-[#81798e]">
        No live FanWar is available right now.
      </p>

    </div>
  );
}


/* =========================================================
   BATTLE PREVIEW
   ========================================================= */

function BattlePreviewCard({
  id,
  title,
  category,
  leftName,
  rightName,
}: {
  id: number;
  title: string;
  category: string;
  leftName: string;
  rightName: string;
}) {

  return (
    <Link
      href={`/battle/${id}`}
      className="group rounded-3xl border border-purple-100/70 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
    >

      <div className="flex items-center justify-between">

        <span className="rounded-full bg-purple-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-purple-600">
          {category}
        </span>

        <span className="text-xs font-bold text-green-500">
          ● Live
        </span>

      </div>


      <h3 className="mt-6 text-xl font-black tracking-[-0.035em]">
        {title}
      </h3>


      <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-2">

        <div className="text-center">

          <div className="flex h-16 items-center justify-center">
            {getTribeLogo(leftName)}
          </div>

          <p className="mt-2 text-xs font-extrabold">
            {leftName}
          </p>

        </div>


        <div className="text-[10px] font-black text-[#aaa2b2]">
          VS
        </div>


        <div className="text-center">

          <div className="flex h-16 items-center justify-center">
            {getTribeLogo(rightName)}
          </div>

          <p className="mt-2 text-xs font-extrabold">
            {rightName}
          </p>

        </div>

      </div>


      <div className="mt-7 flex items-center justify-between text-xs font-bold text-purple-600">

        <span>
          Enter battle
        </span>

        <span className="transition group-hover:translate-x-1">
          →
        </span>

      </div>

    </Link>
  );
}


/* =========================================================
   TRIBE TILE
   ========================================================= */

function TribeTile({
  name,
  logo,
}: {
  name: string;
  logo: ReactNode;
}) {

  return (
    <div className="rounded-3xl border border-purple-100/70 bg-[#fcfbff] p-5 text-center transition hover:-translate-y-1 hover:bg-white hover:shadow-lg">

      <div className="flex h-20 items-center justify-center">
        {logo}
      </div>

      <p className="mt-3 text-xs font-black">
        {name}
      </p>

    </div>
  );
}


/* =========================================================
   STAT
   ========================================================= */

function Stat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {

  return (
    <div className="px-4 py-8 text-center sm:px-6">

      <div className="text-3xl font-black tracking-[-0.04em]">
        {value}
      </div>

      <div className="mt-1 text-xs font-bold text-[#91899d]">
        {label}
      </div>

    </div>
  );
}


/* =========================================================
   HOW STEP
   ========================================================= */

function HowStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {

  return (
    <div className="rounded-3xl border border-white bg-white/75 p-6 shadow-sm">

      <div className="text-xs font-black text-purple-500">
        {number}
      </div>

      <h3 className="mt-5 text-lg font-black">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-[#81798e]">
        {text}
      </p>

    </div>
  );
}


/* =========================================================
   TRIBE LOGO ROUTER
   ========================================================= */

function getTribeLogo(name: string): ReactNode {

  switch (name) {

    case "Chai Gang":
      return <ChaiGangLogo />;

    case "Coffee Crew":
      return <CoffeeCrewLogo />;

    case "Cricket Nation":
      return <CricketLogo />;

    case "Football Tribe":
      return <FootballLogo />;

    case "Biryani Believers":
      return <BiryaniLogo />;

    case "Pizza People":
      return <PizzaLogo />;

    case "Marvel Universe":
      return <MarvelLogo />;

    case "DC Universe":
      return <DCLogo />;

    case "Beach Tribe":
      return <BeachLogo />;

    default:
      return <DefaultTribeLogo />;
  }
}


/* =========================================================
   CHAI GANG LOGO
   ========================================================= */

function ChaiGangLogo() {

  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#fff4e8] shadow-sm">

      <svg
        viewBox="0 0 80 80"
        className="h-16 w-16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >

        <ellipse
          cx="40"
          cy="61"
          rx="22"
          ry="5"
          fill="#D7B99A"
        />

        <path
          d="M23 35H57V51C57 57.627 51.627 63 45 63H35C28.373 63 23 57.627 23 51V35Z"
          fill="#FFFDF9"
          stroke="#2C2533"
          strokeWidth="2.5"
        />

        <ellipse
          cx="40"
          cy="35"
          rx="17"
          ry="6"
          fill="#F6EEE6"
          stroke="#2C2533"
          strokeWidth="2.5"
        />

        <ellipse
          cx="40"
          cy="35"
          rx="12"
          ry="4"
          fill="#9B5B32"
        />

        <path
          d="M57 39C67 37 69 42 66 48C64 52 60 52 56 51"
          stroke="#2C2533"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        <path
          d="M33 26C29 21 36 19 33 14"
          stroke="#C08A65"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        <path
          d="M42 26C38 21 45 19 42 14"
          stroke="#C08A65"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        <path
          d="M51 26C47 21 54 19 51 14"
          stroke="#C08A65"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

      </svg>

    </div>
  );
}


/* =========================================================
   COFFEE CREW LOGO
   ========================================================= */

function CoffeeCrewLogo() {

  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#f4eee8] shadow-sm">

      <svg
        viewBox="0 0 80 80"
        className="h-16 w-16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >

        <ellipse
          cx="40"
          cy="61"
          rx="23"
          ry="5"
          fill="#C8B5A3"
        />

        <path
          d="M22 35H58V51C58 57.627 52.627 63 46 63H34C27.373 63 22 57.627 22 51V35Z"
          fill="#FFFDF9"
          stroke="#2C2533"
          strokeWidth="2.5"
        />

        <ellipse
          cx="40"
          cy="35"
          rx="18"
          ry="7"
          fill="#F1E5DA"
          stroke="#2C2533"
          strokeWidth="2.5"
        />

        <ellipse
          cx="40"
          cy="35"
          rx="13"
          ry="4.5"
          fill="#68432F"
        />

        <path
          d="M58 39C68 37 70 42 67 48C65 52 61 52 57 51"
          stroke="#2C2533"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        <path
          d="M32 26C28 21 35 19 32 14"
          stroke="#9D8575"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        <path
          d="M41 26C37 21 44 19 41 14"
          stroke="#9D8575"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        <path
          d="M50 26C46 21 53 19 50 14"
          stroke="#9D8575"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

      </svg>

    </div>
  );
}


/* =========================================================
   OTHER TRIBE LOGOS
   ========================================================= */

function CricketLogo() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#edf7ee] text-3xl shadow-sm">
      🏏
    </div>
  );
}


function FootballLogo() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef4ff] text-3xl shadow-sm">
      ⚽
    </div>
  );
}


function BiryaniLogo() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff4df] text-3xl shadow-sm">
      🍛
    </div>
  );
}


function PizzaLogo() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff0ec] text-3xl shadow-sm">
      🍕
    </div>
  );
}


function MarvelLogo() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f4efff] text-3xl shadow-sm">
      🦸
    </div>
  );
}


function DCLogo() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#edf4ff] text-3xl shadow-sm">
      🦇
    </div>
  );
}


function BeachLogo() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef9ff] text-3xl shadow-sm">
      🏖️
    </div>
  );
}


function DefaultTribeLogo() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-50 text-3xl shadow-sm">
      ⚔️
    </div>
  );
}