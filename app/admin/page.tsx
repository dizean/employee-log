"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface EmployeeLog {
  id: string;
  employee_name: string;
  gate: string;
  action: string;
  created_at: string;
}

interface Employee {
  id: string;
  name: string;
  role?: string;
  created_at?: string;
  image_url?: string;
}

const ROLES = [
  "Faculty",
  "Maintenance",
  "Staff",
  "Administrator",
  "Guidance Counselor",
  "Security",
  "Librarian",
  "IT Support",
  "Other",
];

export default function AdminDashboard() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"logs" | "employees">("logs");

  const [logs, setLogs] = useState<EmployeeLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");

  const [updating, setUpdating] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const isAdmin = localStorage.getItem("admin_session");

    if (!isAdmin) {
      router.push("/login");
      return;
    }

    fetchLogs();
    fetchEmployees();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-logs`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setLogs(data.logs || []);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-employees`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setEmployees(data.employees || []);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const updateEmployee = async () => {
    setUpdating(true);

    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/update-employee`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          id: selectedEmployee?.id,
          name: editName,
          role: editRole,
        }),
      }
    );

    setIsModalOpen(false);
    fetchEmployees();
    setUpdating(false);
  };

  const deleteEmployee = async () => {
    setDisabling(true);

    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/deactivate-employee`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ id: selectedEmployee?.id }),
      }
    );

    setIsModalOpen(false);
    fetchEmployees();
    setDisabling(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_session");
    router.push("/login");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-6">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">

        <div>
          <h1 className="text-3xl font-bold">
            Employee Dashboard
          </h1>
          <p className="text-gray-500">
            Manage employees and logs
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">

          {/* REGISTER */}
          <button
            onClick={() => router.push("/admin/employees")}
            className="bg-black text-white px-4 py-2 rounded"
          >
            + Register Employee
          </button>

          {/* LOGOUT */}
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded"
          >
            Logout
          </button>

        </div>
      </div>

      {/* ERROR */}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {errorMsg}
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2 rounded ${
            activeTab === "logs"
              ? "bg-black text-white"
              : "bg-white border"
          }`}
        >
          Logs
        </button>

        <button
          onClick={() => setActiveTab("employees")}
          className={`px-4 py-2 rounded ${
            activeTab === "employees"
              ? "bg-black text-white"
              : "bg-white border"
          }`}
        >
          Employees
        </button>
      </div>

      {/* LOGS */}
      {activeTab === "logs" && (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Gate</th>
                <th className="p-3 text-left">Action</th>
                <th className="p-3 text-left">Time</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="p-3">{log.employee_name}</td>
                  <td className="p-3">{log.gate}</td>
                  <td className="p-3">{log.action}</td>
                  <td className="p-3">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* EMPLOYEES */}
      {activeTab === "employees" && (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm table-fixed">

            <thead className="bg-gray-200">
              <tr>
                <th className="p-3 w-[25%] text-left">ID</th>
                <th className="p-3 w-[35%] text-left">Name</th>
                <th className="p-3 w-[20%] text-left">Role</th>
                <th className="p-3 w-[20%] text-left">Date</th>
              </tr>
            </thead>

            <tbody>
              {employees.map((emp) => (
                <tr
                  key={emp.id}
                  onClick={() => {
                    setSelectedEmployee(emp);
                    setEditName(emp.name);
                    setEditRole(emp.role || "");
                    setIsModalOpen(true);
                  }}
                  className="border-t hover:bg-gray-50 cursor-pointer"
                >
                  <td className="p-3 whitespace-nowrap">
                    {emp.id.substring(0, 8)}
                  </td>
                  <td className="p-3">{emp.name}</td>
                  <td className="p-3">{emp.role || "N/A"}</td>
                  <td className="p-3 whitespace-nowrap">
                    {emp.created_at
                      ? new Date(emp.created_at).toLocaleString()
                      : "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>
      )}

      {isModalOpen && selectedEmployee && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">

    <div className="bg-white w-full max-w-lg p-5 rounded-xl shadow-lg max-h-[90vh] overflow-y-auto">

      <h2 className="text-xl font-bold mb-3">
        Employee Info
      </h2>

      {/* IMAGE */}
      {selectedEmployee.image_url && (
        <div className="mb-4">
          <img
            src={selectedEmployee.image_url}
            alt="Employee"
            className="w-full h-52 object-cover rounded-lg border"
          />
        </div>
      )}

      {/* NAME */}
      <input
        className="w-full border p-2 mb-2 rounded"
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
      />

      {/* ROLE */}
      <select
        className="w-full border p-2 mb-2 rounded"
        value={editRole}
        onChange={(e) => setEditRole(e.target.value)}
      >
        <option value="">Select Role</option>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>

      {/* ACTION BUTTONS */}
      <div className="flex gap-2 mt-3">

        <button
          onClick={updateEmployee}
          disabled={updating || disabling}
          className="flex-1 bg-black text-white p-2 rounded disabled:opacity-50"
        >
          {updating ? "Saving..." : "Save"}
        </button>

        <button
          onClick={deleteEmployee}
          disabled={updating || disabling}
          className="flex-1 bg-red-500 text-white p-2 rounded disabled:opacity-50"
        >
          {disabling ? "Disabling..." : "Disable"}
        </button>

      </div>

      {/* CLOSE */}
      <button
        onClick={() => setIsModalOpen(false)}
        className="w-full mt-3 text-sm text-gray-500"
      >
        Close
      </button>

    </div>
  </div>
)}
    </main>
  );
}