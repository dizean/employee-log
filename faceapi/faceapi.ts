let faceapi: typeof import("face-api.js") | null = null;

export const loadFaceModels = async () => {
  if (typeof window === "undefined") return null;

  console.log("Loading face-api...");

  faceapi = await import("face-api.js");

  await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
  console.log("Tiny loaded");

  await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
  console.log("Landmark loaded");

  await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
  console.log("Recognition loaded");

  console.log("All models loaded");

  return faceapi;
};

export const getFaceAPI = () => faceapi;