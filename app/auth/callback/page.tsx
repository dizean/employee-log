"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // ✅ REDIRECT HERE WHEN AUTH EXISTS
        if (session?.user) {
          router.replace("/auth/password");
        }
      }
    );

    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();

      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);

      // fallback redirect
      if (data.session?.user) {
        router.replace("/auth/password");
      }
    };

    checkUser();

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-lg font-bold mb-4">
        Verifying Invitation
      </h1>

      {loading && <p>Loading auth state...</p>}

      <div className="w-full max-w-md bg-gray-100 p-4 rounded mt-4">
        <h2 className="font-bold">Session:</h2>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(session, null, 2)}
        </pre>

        <h2 className="font-bold mt-4">User:</h2>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>
    </div>
  );
}