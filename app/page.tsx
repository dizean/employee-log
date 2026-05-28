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

  const [gate, setGate] = useState("Gate 1");
  const [action] = useState("IN");

  const [cooldownLeft, setCooldownLeft] = useState(0);

  const [faceDetected, setFaceDetected] = useState(false);
  const [faceTooFar, setFaceTooFar] = useState(false);

  const COOLDOWN = 5000;

  // FACE SIZE REQUIREMENT
  // Increase if you want user even closer
  const MIN_FACE_WIDTH = 180;
  const MIN_FACE_HEIGHT = 180;

  const lastScanRef = useRef(0);
  const scanLockRef = useRef(false);
  const lastMatchRef = useRef<string | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: "user",
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;

    stream?.getTracks().forEach((t) => t.stop());
  };

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

      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err) {
      console.error("Fetch logs error:", err);
    }
  }, []);

  const handleFaceLog = useCallback(async () => {
    const now = Date.now();

    if (scanLockRef.current) return;

    if (now - lastScanRef.current < COOLDOWN) {
      return;
    }

    scanLockRef.current = true;
    lastScanRef.current = now;

    try {
      setLoading(true);

      const faceapi = getFaceAPI();

      if (!faceapi || !videoRef.current) return;

      // FULL FACE RECOGNITION
      const detection = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5,
          })
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        return;
      }

      // FACE SIZE CHECK
      const box = detection.detection.box;

      if (
        box.width < MIN_FACE_WIDTH ||
        box.height < MIN_FACE_HEIGHT
      ) {
        setFaceTooFar(true);

        setResult({
          matched: false,
          action: "MOVE CLOSER",
          message: "Please move closer to the camera",
        });

        return;
      }

      setFaceTooFar(false);

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

      // DUPLICATE CHECK
      if (
        data.employee_id &&
        lastMatchRef.current === data.employee_id
      ) {
        setResult({
          matched: true,
          action: "DUPLICATE",
          message: "Already scanned recently",
        });

        return;
      }

      lastMatchRef.current = data.employee_id;

      setResult(data);

      console.log("Face log result:", data);

      if (data.matched) {
        fetchLogs();
      }
    } catch (err) {
      console.error(err);

      setResult({
        matched: false,
        message: "System error",
      });
    } finally {
      setLoading(false);
      scanLockRef.current = false;
    }
  }, [gate, action, fetchLogs]);

  useEffect(() => {
    const init = async () => {
      await loadFaceModels();

      setModelsLoaded(true);

      await startCamera();

      await fetchLogs();
    };

    init();

    const channel = supabase
      .channel("logs-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "employee_logs",
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

  // SMART FACE DETECTION LOOP
  useEffect(() => {
    if (!modelsLoaded) return;

    let interval: NodeJS.Timeout;

    const detectFaceAndScan = async () => {
      try {
        if (scanLockRef.current) return;

        const now = Date.now();

        // COOLDOWN ACTIVE
        if (now - lastScanRef.current < COOLDOWN) {
          return;
        }

        const faceapi = getFaceAPI();

        if (!faceapi || !videoRef.current) return;

        // LIGHTWEIGHT DETECTION
        const detection = await faceapi.detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 224,
            scoreThreshold: 0.5,
          })
        );

        // NO FACE
        if (!detection) {
          setFaceDetected(false);
          setFaceTooFar(false);
          return;
        }

        setFaceDetected(true);

        // CHECK FACE SIZE
        const box = detection.box;

        const isTooFar =
          box.width < MIN_FACE_WIDTH ||
          box.height < MIN_FACE_HEIGHT;

        setFaceTooFar(isTooFar);

        // TOO FAR = DO NOT SCAN
        if (isTooFar) {
          setResult({
            matched: false,
            action: "MOVE CLOSER",
            message: "Face detected but too far from camera",
          });

          return;
        }

        // GOOD DISTANCE -> SCAN
        await handleFaceLog();

      } catch (err) {
        console.error("Auto detect error:", err);
      }
    };

    interval = setInterval(detectFaceAndScan, 800);

    return () => clearInterval(interval);

  }, [modelsLoaded, handleFaceLog]);

  // COOLDOWN TIMER
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();

      const remaining = Math.max(
        0,
        COOLDOWN - (now - lastScanRef.current)
      );

      setCooldownLeft(Math.ceil(remaining / 1000));
    }, 200);

    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-4">

      <h1 className="text-2xl font-bold text-center mb-4">
        Employee Log System
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* CAMERA */}
        <div className="bg-white p-4 rounded-xl shadow">

          <div className="relative">

            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded-xl border"
            />

            {/* STATUS BADGES */}
            <div className="absolute top-3 left-3 flex flex-col gap-2">

              {/* FACE DETECTION */}
              <div
                className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                  faceDetected
                    ? "bg-green-600"
                    : "bg-red-500"
                }`}
              >
                {faceDetected
                  ? "Face Detected"
                  : "No Face"}
              </div>

              {/* DISTANCE */}
              {faceDetected && (
                <div
                  className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                    faceTooFar
                      ? "bg-yellow-500"
                      : "bg-blue-600"
                  }`}
                >
                  {faceTooFar
                    ? "Move Closer"
                    : "Good Distance"}
                </div>
              )}

            </div>

          </div>

          {/* SCAN STATUS */}
          <div className="mt-4">

            <div className="flex items-center justify-between mb-2">

              <p className="font-semibold">
                Smart Auto Scan
              </p>

              <div
                className={`px-3 py-1 rounded-full text-sm text-white ${
                  loading
                    ? "bg-yellow-500"
                    : cooldownLeft > 0
                    ? "bg-red-500"
                    : "bg-green-600"
                }`}
              >
                {loading
                  ? "Scanning..."
                  : cooldownLeft > 0
                  ? `Next scan in ${cooldownLeft}s`
                  : "Ready"}
              </div>

            </div>

            {/* TIMER BAR */}
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">

              <div
                className="h-full bg-black transition-all duration-200"
                style={{
                  width: `${
                    cooldownLeft > 0
                      ? ((COOLDOWN - cooldownLeft * 1000) /
                          COOLDOWN) *
                        100
                      : 100
                  }%`,
                }}
              />

            </div>

          </div>

          {/* RESULT */}
          {result && (
            <div className="mt-4 p-4 rounded-xl bg-black text-white text-center">

              <p className="font-bold text-lg">
                {result.action || "SCAN"}
              </p>

              <p className="text-sm mt-1">
                {result.message}
              </p>

            </div>
          )}

          {/* CONTROLS */}
          <div className="flex gap-2 mt-4">

            <select
              value={gate}
              onChange={(e) => setGate(e.target.value)}
              className="border p-3 rounded-lg w-full"
            >
              <option>Gate 1</option>
              <option>Gate 2</option>
              <option>Gate 3</option>
            </select>

          </div>

        </div>

        {/* LOGS */}
        <div className="bg-white p-4 rounded-xl shadow">

          <h2 className="font-semibold mb-3">
            Live Logs
          </h2>

          <div className="space-y-3 max-h-[600px] overflow-auto">

            {logs.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No logs yet
              </p>
            ) : (
              logs.map((log, i) => (
                <div
                  key={log.id || i}
                  className="border p-3 rounded-xl"
                >

                  <p className="font-bold">
                    {log.employee_name || "Unknown"}
                  </p>

                  <p className="text-sm">
                    {log.action} • {log.gate}
                  </p>

                  <p className="text-xs text-gray-500">
                    {log.created_at
                      ? new Date(
                          log.created_at
                        ).toLocaleString()
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