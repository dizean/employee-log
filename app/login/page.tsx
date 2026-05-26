"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, ShieldCheck, User } from "lucide-react";

export default function AdminLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Login failed");
        return;
      }

      localStorage.setItem("admin_session", JSON.stringify(data.session));

      router.push("/admin");
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f7fb] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-8">
          
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center mb-4">
              <ShieldCheck size={26} />
            </div>

            <h1 className="text-2xl font-bold text-gray-900">
              Admin Login
            </h1>

            <p className="text-sm text-gray-500 mt-1 text-center">
              Sign in to access the admin dashboard
            </p>
          </div>
          <div className="mb-4">
            <label className="text-sm text-gray-600 mb-2 block">
              Email
            </label>

            <div className="flex items-center border border-gray-200 rounded-xl px-3 focus-within:border-black transition">
              <User size={18} className="text-gray-400" />

              <input
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 outline-none bg-transparent text-sm"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="text-sm text-gray-600 mb-2 block">
              Password
            </label>

            <div className="flex items-center border border-gray-200 rounded-xl px-3 focus-within:border-black transition">
              <LockKeyhole size={18} className="text-gray-400" />

              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 outline-none bg-transparent text-sm"
              />
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-black hover:bg-gray-900 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-all duration-200 active:scale-[0.98]"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Secure Admin Access
        </p>
      </div>
    </main>
  );
}