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
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const lastScanRef = useRef(0);
  const lastMatchRef = useRef<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      const diff = Date.now() - lastScanRef.current;
      const left = Math.max(0, COOLDOWN - diff);
      setCooldownLeft(left);
    }, 200);

    return () => clearInterval(t);
  }, []);

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

  const fetchLogs = async () => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-logs`
    );
    const data = await res.json();
    console.log("Fetched logs:", data);
    setLogs(data.logs || []);
  };

  const handleFaceLog = useCallback(async () => {
    const now = Date.now();

    if (now - lastScanRef.current < COOLDOWN) return;

    lastScanRef.current = now;

    try {
      if (loading) return;

      setLoading(true);
      setResult(null);

      const faceapi = getFaceAPI();
      if (!faceapi || !videoRef.current) return;

      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setResult({
          matched: false,
          message: "No face detected",
        });
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
          body: JSON.stringify({
            descriptor,
            gate,
            action,
          }),
        }
      );

      const data = await res.json();
      if (data.employee_id && lastMatchRef.current === data.employee_id) {
        setResult({
          matched: true,
          employee_name: data.employee_name,
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
      setResult({
        matched: false,
        message: "System error",
      });
    } finally {
      setLoading(false);
    }
  }, [loading, gate, action]);

  useEffect(() => {
    const init = async () => {
      await loadFaceModels();
      setModelsLoaded(true);
      startCamera();
      fetchLogs();
    };

    init();

    const channel = supabase
      .channel("logs-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "logs" }, (payload) => {
        setLogs((prev) => [payload.new, ...prev]);
      })
      .subscribe();

    return () => {
      stopCamera();
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!autoScan) return;

    const interval = setInterval(() => {
      handleFaceLog();
    }, 3000);

    return () => clearInterval(interval);
  }, [autoScan, handleFaceLog]);

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold text-center mb-2">
        Employee Log System
      </h1>

      <p className="text-center text-sm text-gray-600 mb-4">
        Next scan in: {Math.ceil(cooldownLeft / 1000)}s
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="bg-white rounded-2xl shadow-lg p-5 relative">

          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded-xl border"
            />

            {result && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`px-6 py-4 rounded-xl text-white text-center ${result.matched ? "bg-green-600/90" : "bg-red-600/90"
                  }`}>
                  <p className="font-bold text-lg">
                    {result.action}
                  </p>

                  <p className="text-sm mt-1">
                    {result.message}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <select value={gate} onChange={(e) => setGate(e.target.value)} className="border p-2 rounded-lg">
              <option>Gate 1</option>
              <option>Gate 2</option>
              <option>Gate 3</option>
            </select>

            <select value={action} onChange={(e) => setAction(e.target.value)} className="border p-2 rounded-lg">
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </select>
          </div>

          <button
            onClick={handleFaceLog}
            disabled={loading || !modelsLoaded}
            className="w-full mt-4 bg-black text-white p-3 rounded-xl"
          >
            {loading ? "Scanning..." : "Scan Face"}
          </button>

          <button
            onClick={() => setAutoScan(!autoScan)}
            className={`w-full mt-3 p-3 rounded-xl text-white ${autoScan ? "bg-red-500" : "bg-green-600"
              }`}
          >
            {autoScan ? "Stop Auto Scan" : "Start Auto Scan"}
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-5">
          <h2 className="font-semibold mb-4 text-lg">
            Live Logs
          </h2>

          <div className="space-y-3 max-h-[600px] overflow-auto">

            {logs.map((log, i) => (
              <div
                key={i}
                className="border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition"
              >
                <p className="text-lg font-bold text-gray-900">
                  {log.employee_name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${log.action === "IN"
                        ? "bg-green-100 text-green-700"
                        : log.action === "OUT"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-200 text-gray-700"
                      }`}
                  >
                    {log.action}
                  </span>

                  <span className="text-xs text-gray-500">
                    Gate: <b>{log.gate}</b>
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-medium text-gray-800">
                    {new Date(log.created_at).toLocaleDateString()}
                  </span>
                  {" • "}
                  {new Date(log.created_at).toLocaleTimeString()}
                </p>

                <p className="text-xs text-gray-400 mt-1">
                  ID: {log.employee_id?.slice(0, 8)}...
                </p>

              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}