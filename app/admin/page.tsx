"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const isAdmin = localStorage.getItem("admin_session");

    if (!isAdmin) {
      router.push("/login");
      return;
    }

    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/employee_logs?select=*`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
      }
    );

    const data = await res.json();
    setLogs(data);
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_session");
    router.push("/login");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">
            Admin Dashboard
          </h1>

          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
          >
            Logout
          </button>
        </div>

        <button
          onClick={() => router.push("/admin/employees")}
          className="mb-4 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition"
        >
          + Register Employee
        </button>

        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-2 text-left">Employee ID</th>
                <th className="text-left">Gate</th>
                <th className="text-left">Action</th>
                <th className="text-left">Time</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">
                    {log.employee_id?.slice(0, 8)}
                  </td>
                  <td>{log.gate}</td>
                  <td>{log.action}</td>
                  <td>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}