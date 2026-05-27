"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadFaceModels, getFaceAPI } from "@/faceapi/faceapi";

const POSITIONS = [
  "Faculty",
  "Maintenance",
  "Staff",
  "Administrator",
  "Guidance Counselor",
  "Registrar",
  "Security Personnel",
  "Librarian",
  "School Nurse",
  "IT Personnel",
  "Accounting Staff",
  "Cashier",
  "Dean",
  "Program Head",
  "Laboratory Assistant",
  "Utility Personnel",
  "HR Personnel",
  "Research Coordinator",
  "School Principal",
  "Vice Principal",
  "Clinic Staff",
  "Other",
];

export default function RegisterEmployee() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const init = async () => {
      try {
        await loadFaceModels();

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error(err);
        setError("Camera or Face API failed to initialize");
      }
    };

    init();

    return () => {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const registerEmployee = async () => {
    if (loading) return;

    try {
      setLoading(true);
      setError("");

      if (!name || !role) {
        setError("Please complete all fields");
        return;
      }

      const faceapi = getFaceAPI();

      if (!faceapi || !videoRef.current) {
        setError("Camera or Face API not ready");
        return;
      }

      const detection = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setError("No face detected. Please try again.");
        return;
      }

      const descriptor = Array.from(detection.descriptor);

      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      const ctx = canvas.getContext("2d");
      ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      const image_base64 = canvas.toDataURL("image/jpeg");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/employee-register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            name,
            role,
            descriptor,
            image_base64,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      alert("Employee registered successfully!");

      setName("");
      setRole("");

      router.push("/admin");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden">

        {/* HEADER */}
        <div className="bg-black text-white p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Register Employee
              </h1>
              <p className="text-gray-300 mt-1">
                Capture employee face and save profile
              </p>
            </div>

            <button
              onClick={() => router.push("/admin")}
              className="bg-white/10 hover:bg-white/20 transition px-4 py-2 rounded-xl text-sm"
            >
              ← Back to Admin
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="p-5 md:p-6">

          {/* ERROR */}
          {error && (
            <div className="mb-4 bg-red-100 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* CAMERA */}
          <div className="rounded-2xl overflow-hidden border bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full aspect-video object-cover"
            />
          </div>

          {/* FORM */}
          <div className="mt-5 space-y-4">

            {/* NAME */}
            <div>
              <label className="text-sm font-medium">
                Employee Name
              </label>
              <input
                disabled={loading}
                className="w-full border p-3 rounded-xl mt-2 focus:ring-2 focus:ring-black outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* ROLE */}
            <div>
              <label className="text-sm font-medium">
                Position / Role
              </label>

              <select
                disabled={loading}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border p-3 rounded-xl mt-2 bg-white focus:ring-2 focus:ring-black outline-none"
              >
                <option value="">Select Position</option>
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* BUTTON */}
            <button
              onClick={registerEmployee}
              disabled={loading}
              className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-xl disabled:opacity-50"
            >
              {loading ? "Registering..." : "Capture & Save Face"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
