"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const isAdmin = localStorage.getItem("admin");

    if (!isAdmin) {
      router.push("/login");
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

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">
          Admin Dashboard
        </h1>

        <button
          onClick={() => router.push("/admin/employees")}
          className="mb-4 bg-black text-white px-4 py-2 rounded"
        >
          + Register Employee
        </button>

        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-2">Employee ID</th>
                <th>Gate</th>
                <th>Action</th>
                <th>Time</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2"> {log.employee_id?.slice(0, 8)}</td>
                  <td>{log.gate}</td>
                  <td>{log.action}</td>
                  <td>{new Date(log.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}