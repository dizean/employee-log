"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { loadFaceModels, getFaceAPI } from "../faceapi/faceapi";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [autoScan, setAutoScan] = useState(false);

  const [gate, setGate] = useState("Gate 1");
  const [action, setAction] = useState("IN");

  const COOLDOWN = 5000;
  const lastScanRef = useRef(0);
  const scanLockRef = useRef(false);
  const lastMatchRef = useRef<string | null>(null);

  // ---------------- CAMERA ----------------
  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach((t) => t.stop());
  };

  // ---------------- FETCH LOGS ----------------
  const fetchLogs = useCallback(async () => {
    try {
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

      // IMPORTANT FIX: always ensure array
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err) {
      console.error("Fetch logs error:", err);
    }
  }, []);

  // ---------------- FACE SCAN ----------------
  const handleFaceLog = useCallback(async () => {
    const now = Date.now();

    if (scanLockRef.current) return;
    if (now - lastScanRef.current < COOLDOWN) return;

    scanLockRef.current = true;
    lastScanRef.current = now;

    try {
      setLoading(true);
      setResult(null);

      const faceapi = getFaceAPI();
      if (!faceapi || !videoRef.current) return;

      const detection = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setResult({ matched: false, message: "No face detected" });
        return;
      }

      const descriptor = Array.from(detection.descriptor);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/face-log`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ descriptor, gate, action }),
        }
      );

      const data = await res.json();

      if (data.employee_id && lastMatchRef.current === data.employee_id) {
        setResult({
          matched: true,
          action: "DUPLICATE",
          message: "Already scanned recently",
        });
        return;
      }

      lastMatchRef.current = data.employee_id;
      setResult(data);

      if (data.matched) {
        fetchLogs();
      }
    } catch (err) {
      console.error(err);
      setResult({ matched: false, message: "System error" });
    } finally {
      setLoading(false);
      scanLockRef.current = false;
    }
  }, [gate, action, fetchLogs]);

  // ---------------- INIT ----------------
  useEffect(() => {
    const init = async () => {
      await loadFaceModels();
      setModelsLoaded(true);
      await startCamera();
      await fetchLogs();
    };

    init();

    // ⚠️ FIXED: use correct table name if needed
    const channel = supabase
      .channel("logs-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "logs", // CHANGE THIS if your table is employee_logs
        },
        (payload) => {
          const newLog = payload.new;

          if (!newLog) return;

          setLogs((prev) => [newLog, ...prev]);
        }
      )
      .subscribe();

    return () => {
      stopCamera();
      supabase.removeChannel(channel);
    };
  }, [fetchLogs]);

  // ---------------- AUTO SCAN ----------------
  useEffect(() => {
    if (!autoScan) return;

    const interval = setInterval(() => {
      handleFaceLog();
    }, 3000);

    return () => clearInterval(interval);
  }, [autoScan, handleFaceLog]);

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold text-center mb-4">
        Employee Log System
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* CAMERA */}
        <div className="bg-white p-4 rounded-xl shadow">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full rounded-xl border"
          />

          {result && (
            <div className="mt-3 p-3 rounded bg-black text-white text-center">
              <p className="font-bold">{result.action}</p>
              <p className="text-sm">{result.message}</p>
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <select value={gate} onChange={(e) => setGate(e.target.value)} className="border p-2 rounded w-full">
              <option>Gate 1</option>
              <option>Gate 2</option>
              <option>Gate 3</option>
            </select>

            <select value={action} onChange={(e) => setAction(e.target.value)} className="border p-2 rounded w-full">
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </select>
          </div>

          <button
            onClick={handleFaceLog}
            disabled={loading || !modelsLoaded}
            className="w-full mt-3 bg-black text-white p-3 rounded"
          >
            {loading ? "Scanning..." : "Scan Face"}
          </button>

          <button
            onClick={() => setAutoScan(!autoScan)}
            className={`w-full mt-2 p-3 rounded text-white ${
              autoScan ? "bg-red-500" : "bg-green-600"
            }`}
          >
            {autoScan ? "Stop Auto Scan" : "Start Auto Scan"}
          </button>
        </div>

        {/* LOGS */}
        <div className="bg-white p-4 rounded-xl shadow">
          <h2 className="font-semibold mb-3">Live Logs</h2>

          <div className="space-y-3 max-h-[600px] overflow-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500 text-sm">No logs yet</p>
            ) : (
              logs.map((log, i) => (
                <div key={log.id || i} className="border p-3 rounded">
                  <p className="font-bold">
                    {log.employee_name || "Unknown"}
                  </p>

                  <p className="text-sm">
                    {log.action} • {log.gate}
                  </p>

                  <p className="text-xs text-gray-500">
                    {log.created_at
                      ? new Date(log.created_at).toLocaleString()
                      : "No date"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </main>
  );
}