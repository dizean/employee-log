"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SetupPassword() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState<any>(null);

  const isStrong = (pwd: string) =>
    pwd.length >= 8 &&
    /[A-Z]/.test(pwd) &&
    /[a-z]/.test(pwd) &&
    /[0-9]/.test(pwd);

  useEffect(() => {
    const init = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        router.replace("/login");
        return;
      }

      setUser(data.session.user);
      setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      } else {
        setUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleSubmit = async () => {
    if (!password || !confirm) {
      alert("Please fill all fields");
      return;
    }

    if (password !== confirm) {
      alert("Passwords do not match");
      return;
    }

    if (!isStrong(password)) {
      alert(
        "Password must be at least 8 characters and include uppercase, lowercase, and a number"
      );
      return;
    }

    setSaving(true);

    try {
      // ✅ THIS IS THE ONLY CORRECT WAY (NO ADMIN API)
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }

      // optional: refresh session after password update
      await supabase.auth.refreshSession();

      // optional cleanup flag
      localStorage.setItem("first_login_done", "true");

      // redirect after success
      router.replace("/admin");
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-6 rounded-xl shadow">
          Checking session...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2">
          Set Your Password
        </h1>

        <p className="text-sm text-gray-500 mb-6">
          Create a secure password for your account ({user?.email})
        </p>

        <input
          type="password"
          placeholder="New Password"
          className="w-full border border-gray-300 p-3 rounded-lg mb-4 outline-none focus:ring-2 focus:ring-black"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="Confirm Password"
          className="w-full border border-gray-300 p-3 rounded-lg mb-6 outline-none focus:ring-2 focus:ring-black"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full bg-black hover:bg-gray-800 transition text-white p-3 rounded-lg font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Set Password"}
        </button>
      </div>
    </main>
  );
}