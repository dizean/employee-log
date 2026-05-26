"use client";

import { useEffect, useRef, useState } from "react";
import { loadFaceModels, getFaceAPI } from "@/faceapi/faceapi";

export default function RegisterEmployee() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [name, setName] = useState("");
    const [role, setRole] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {

        const init = async () => {
            await loadFaceModels();

            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        };

        init();

        return () => {
            const stream = videoRef.current?.srcObject as MediaStream;
            stream?.getTracks().forEach((t) => t.stop());
        };
    }, []);

    const registerEmployee = async () => {
        try {
            setLoading(true);

            const faceapi = getFaceAPI();

            if (!faceapi || !videoRef.current) {
                alert("Camera or Face API not ready");
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
                alert("No face detected");
                return;
            }

            const descriptor = Array.from(detection.descriptor);

            // 📸 CAPTURE IMAGE FROM VIDEO
            const canvas = document.createElement("canvas");
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;

            const ctx = canvas.getContext("2d");
            ctx?.drawImage(
                videoRef.current,
                0,
                0,
                canvas.width,
                canvas.height
            );

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
        } catch (err: any) {
            console.error(err);
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="w-full max-w-lg bg-white p-5 rounded-2xl shadow">
                <h1 className="text-xl font-bold mb-4">
                    Register Employee (Admin)
                </h1>

                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="rounded-lg w-full"
                />

                <input
                    className="w-full border p-2 mt-3 rounded"
                    placeholder="Employee Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />

                <input
                    className="w-full border p-2 mt-2 rounded"
                    placeholder="Role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                />

                <button
                    onClick={registerEmployee}
                    disabled={loading}
                    className="w-full mt-3 bg-black text-white p-2 rounded"
                >
                    {loading ? "Registering..." : "Capture & Save Face"}
                </button>
            </div>
        </main>
    );
}