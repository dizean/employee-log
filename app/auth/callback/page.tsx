"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error) {
        console.error(error);
        router.push("/auth/password");
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (data.session) {
        router.push("/admin");
      } else {
        router.push("/login");
      }
    };

    handleAuth();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      Processing invitation...
    </div>
  );
}