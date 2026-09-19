"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import FanWarsLogo from "@/components/fanwars-logo";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleLogin(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setLoading(true);
        setError("");

        const { data, error: loginError } =
            await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

        if (loginError) {
            setError(loginError.message);
            setLoading(false);
            return;
        }

        const user = data.user;

        if (!user) {
            setError("Login succeeded, but no user session was found.");
            setLoading(false);
            return;
        }

        // Check whether this user has already completed Fan Identity.
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            console.error("Profile lookup failed:", profileError);
            setError("We couldn't load your FanWars profile.");
            setLoading(false);
            return;
        }

        if (profile) {
            // Existing FanWars user → go directly to Home.
            router.replace("/home");
        } else {
            // New authenticated user → complete Fan Identity.
            router.replace("/onboarding");
        }
    }

    return (
        <main className="min-h-screen bg-[#fcfbf8] text-[#171525]">
            <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
                {/* Logo */}
                <div className="flex justify-center">
                    <FanWarsLogo href="/" size="lg" />
                </div>

                {/* Heading */}
                <div className="mt-12 text-center">
                    <h1 className="text-4xl font-black tracking-[-0.045em]">
                        Welcome back
                    </h1>

                    <p className="mt-3 text-base text-[#686577]">
                        Sign in and get back into the FanWars.
                    </p>
                </div>

                {/* Form */}
                <form
                    onSubmit={handleLogin}
                    className="mt-8 rounded-[2rem] border border-black/[0.06] bg-white p-7 shadow-sm"
                >
                    <div>
                        <label
                            htmlFor="email"
                            className="text-sm font-bold text-[#171525]"
                        >
                            Email
                        </label>

                        <input
                            id="email"
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="you@example.com"
                            className="mt-2 w-full rounded-2xl border border-[#dfe2ea] bg-[#f8f9fb] px-4 py-3.5 text-sm outline-none transition placeholder:text-[#9a97a5] focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
                        />
                    </div>

                    <div className="mt-5">
                        <div className="flex items-center justify-between">
                            <label
                                htmlFor="password"
                                className="text-sm font-bold text-[#171525]"
                            >
                                Password
                            </label>
                        </div>

                        <input
                            id="password"
                            type="password"
                            required
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Enter your password"
                            className="mt-2 w-full rounded-2xl border border-[#dfe2ea] bg-[#f8f9fb] px-4 py-3.5 text-sm outline-none transition placeholder:text-[#9a97a5] focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
                        />
                    </div>

                    {error && (
                        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-6 w-full rounded-full bg-[#171525] px-5 py-4 text-sm font-extrabold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? "SIGNING IN..." : "SIGN IN →"}
                    </button>
                </form>

                {/* Signup */}
                <p className="mt-7 text-center text-sm text-[#686577]">
                    New to FanWars?{" "}
                    <Link
                        href="/signup"
                        className="font-extrabold text-purple-600 hover:text-purple-700"
                    >
                        Create your account
                    </Link>
                </p>

                <div className="mt-auto pt-10 text-center text-xs font-semibold text-[#9a97a5]">
                    Passion creates tribes. Tribes create influence.
                </div>
            </div>
        </main>
    );
}