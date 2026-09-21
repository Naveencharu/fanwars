"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import FanWarsLogo from "@/components/fanwars-logo";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams.get("redirect");
    const ref = searchParams.get("ref");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleLogin() {

        if (loading) {
            return;
        }

        setError("");

        const cleanEmail = email.trim();

        if (!cleanEmail) {
            setError("Please enter your email.");
            return;
        }

        if (!password) {
            setError("Please enter your password.");
            return;
        }

        setLoading(true);

        try {
            const { data, error: loginError } =
                await supabase.auth.signInWithPassword({
                    email: cleanEmail,
                    password,
                });

            if (loginError) {
                console.error("Login error:", loginError);
                setError(loginError.message);
                setLoading(false);
                return;
            }

            const user = data.user;

            if (!user) {
                setError(
                    "Login succeeded, but no user session was found."
                );
                setLoading(false);
                return;
            }

            const {
                data: profile,
                error: profileError,
            } = await supabase
                .from("profiles")
                .select("id")
                .eq("id", user.id)
                .maybeSingle();

            if (profileError) {
                console.error(
                    "Profile lookup failed:",
                    profileError
                );

                setError(
                    "Login worked, but we couldn't load your FanWars profile."
                );

                setLoading(false);
                return;
            }

            if (profile) {
                if (redirect) {
                    const redirectUrl = new URL(
                        redirect,
                        window.location.origin
                    );

                    if (ref && !redirectUrl.searchParams.has("ref")) {
                        redirectUrl.searchParams.set("ref", ref);
                    }

                    router.replace(
                        `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`
                    );
                } else {
                    router.replace("/home");
                }
            } else {
                const onboardingUrl = ref
                    ? `/onboarding?ref=${encodeURIComponent(ref)}`
                    : "/onboarding";

                router.replace(onboardingUrl);
            }
        } catch (error) {
            console.error("Unexpected login error:", error);

            setError(
                error instanceof Error
                    ? error.message
                    : "Something went wrong while logging in."
            );

            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-[#fcfbf8] px-5 py-8 sm:px-8">
            <div className="mx-auto flex min-h-[90vh] max-w-md flex-col justify-center">

                {/* Logo */}
                <div className="mb-8 text-center">
                    <div className="flex justify-center">
                        <FanWarsLogo href="/" size="lg" />
                    </div>

                    <p className="mt-4 text-sm font-semibold text-[#777286]">
                        Welcome back to FanWars.
                    </p>
                </div>

                {/* Login Card */}
                <div className="rounded-[30px] border border-black/[0.06] bg-white p-6 shadow-[0_20px_60px_rgba(40,25,70,0.08)] sm:p-8">

                    <div className="mb-7">
                        <h1 className="text-2xl font-black tracking-tight text-[#171525]">
                            Log in
                        </h1>

                        <p className="mt-2 text-sm leading-6 text-[#777286]">
                            Sign in to continue your FanWars journey.
                        </p>
                    </div>

                    {/* Email */}
                    <div>
                        <label
                            htmlFor="email"
                            className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em] text-[#777286]"
                        >
                            Email
                        </label>

                        <input
                            id="email"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    handleLogin();
                                }
                            }}
                            placeholder="you@example.com"
                            className="w-full rounded-2xl border border-black/[0.08] bg-[#fcfbf8] px-4 py-3.5 text-sm font-semibold text-[#171525] outline-none transition placeholder:text-[#aaa4b1] focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
                        />
                    </div>

                    {/* Password */}
                    <div className="mt-5">
                        <label
                            htmlFor="password"
                            className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em] text-[#777286]"
                        >
                            Password
                        </label>

                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    handleLogin();
                                }
                            }}
                            placeholder="Enter your password"
                            className="w-full rounded-2xl border border-black/[0.08] bg-[#fcfbf8] px-4 py-3.5 text-sm font-semibold text-[#171525] outline-none transition placeholder:text-[#aaa4b1] focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-semibold leading-6 text-red-700">
                            {error}
                        </div>
                    )}

                    {/* Login Button */}
                    <button
                        type="button"
                        onClick={handleLogin}
                        disabled={loading}
                        className="mt-6 w-full rounded-full bg-[#171525] px-5 py-4 text-sm font-extrabold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? "Signing in..." : "Log in"}
                    </button>

                    {/* Signup */}
                    <p className="mt-6 text-center text-sm font-semibold text-[#777286]">
                        Don't have a FanWars account?{" "}
                        <Link
                            href={
                                ref
                                    ? `/signup?ref=${encodeURIComponent(ref)}${redirect
                                        ? `&redirect=${encodeURIComponent(redirect)}`
                                        : ""
                                    }`
                                    : redirect
                                        ? `/signup?redirect=${encodeURIComponent(redirect)}`
                                        : "/signup"
                            }
                            className="font-extrabold text-purple-600 hover:text-purple-700"
                        >
                            Sign up
                        </Link>
                    </p>
                </div>

                {/* Back */}
                <div className="mt-6 text-center">
                    <Link
                        href="/"
                        className="text-sm font-bold text-[#777286] hover:text-purple-600"
                    >
                        ← Back to FanWars
                    </Link>
                </div>
            </div>
        </main>
    );
}