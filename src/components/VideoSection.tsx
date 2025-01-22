"use client";

import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";
import "../styles/VideoSection.css";  // CSS
import Controls from "./Controls";    // Tlačidlá

type FaceSizeStatus = "none" | "small" | "big" | "ok";

const VideoSection: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Modely, kamera
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);

  // Prepínač, či zobrazovať bounding boxy
  const [showGuides, setShowGuides] = useState(true);

  // Text a farba textu pre info o stave tváre
  const [infoText, setInfoText] = useState("Camera is off");
  const [infoColor, setInfoColor] = useState("white");

  // Uložíme si reálne rozmery zobrazeného videa (px)
  const [videoRect, setVideoRect] = useState({ width: 0, height: 0 });

  // **Prahy** pre veľkosť tváre:
  // Zvýšime maxRatio na 0.8 (namiesto 0.7),
  // aby tvár nebola tak rýchlo vyhodnotená ako „príliš veľká“.
  const minRatio = 0.6;
  const maxRatio = 0.9;

  // **Elipsa** parametre budeme počítať rovnako
  // v HTML (getEllipseStyle) a v isFaceInsideEllipse + checkFaceSize
  const ellipseMultX = 0.15;  // 15 % šírky ako radiusX
  const ellipseRatio = 1.5;   // 1.5 pomer na výšku

  /**
   * 1) Načítanie modelov FaceAPI
   */
  useEffect(() => {
    if (typeof window !== "undefined") {
      Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      ])
        .then(() => {
          console.log("Models loaded");
          setModelsLoaded(true);
        })
        .catch((err) => console.error("Error loading models", err));
    }
  }, []);

  /**
   * 2) Ukladáme reálne rozmery zobrazeného videa (getBoundingClientRect).
   */
  const updateVideoRect = () => {
    if (!videoRef.current) return;
    const rect = videoRef.current.getBoundingClientRect();
    setVideoRect({ width: rect.width, height: rect.height });
  };

  useEffect(() => {
    function handleResize() {
      updateVideoRect();
      if (!showGuides) {
        clearCanvas();
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isCameraOn, showGuides]);

  /**
   * 3) Zapnutie / vypnutie videa
   */
  const startVideo = async () => {
    if (!modelsLoaded) {
      console.warn("Models are not loaded yet");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsCameraOn(true);
          setShowGuides(true);

          setInfoText("Align Your Face to the Center");
          setInfoColor("white");

          updateVideoRect();
          detectFaces();
        };
      }
    } catch (error) {
      console.error("Error Starting Video", error);
    }
  };

  const stopVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
    clearCanvas();
    setInfoText("Camera is off");
    setInfoColor("white");
    setVideoRect({ width: 0, height: 0 });
    setShowGuides(true)
  };

  const toggleVideo = () => {
    if (isCameraOn) stopVideo();
    else startVideo();
  };

  /**
   * 4) Hlavná detekčná slučka
   */
  const detectFaces = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const detections = await faceapi.detectAllFaces(
      videoRef.current,
      new faceapi.SsdMobilenetv1Options()
    );

    let newText = "Align Your Face to the Center";
    let newColor = "white";

    if (detections.length === 0) {
      newText = "No Face Detected";
      newColor = "red";
      // Poďme nastaviť aj ovál na červený => "none"
      setEllipseColorStatus("none");
    } else if (detections.length > 1) {
      newText = "Multiple Faces Detected - Please Only One Person";
      newColor = "red";
      setEllipseColorStatus("none");
    } else {
      // Presne 1 tvár
      const detection = detections[0];
      const c = canvasRef.current!;
      const w = c.width;

      const inside = isFaceInsideEllipse(detection, w);
      if (!inside) {
        newText = "Place Your Face in the Marked Oval";
        newColor = "red";
        setEllipseColorStatus("none");
      } else {
        const s = checkFaceSize(detection, w);
        switch (s) {
          case "small":
            newText = "Move Closer";
            newColor = "orange";
            setEllipseColorStatus("small");
            break;
          case "big":
            newText = "Move Further Away";
            newColor = "orange";
            setEllipseColorStatus("big");
            break;
          case "ok":
            newText = "Great, You Are in the Correct Position";
            newColor = "green";
            setEllipseColorStatus("ok");
            break;
        }
      }
    }

    setInfoText(newText);
    setInfoColor(newColor);

    if (showGuides) {
      drawDetections(detections);
    } else {
      clearCanvas();
    }

    requestAnimationFrame(detectFaces);
  };

  /**
   * 5) Overenie, či je stred tváre v elipse
   */
  const isFaceInsideEllipse = (d: faceapi.FaceDetection, w: number) => {
    if (!canvasRef.current) return false;

    const box = d.box;
    const mirroredX = w - (box.x + box.width);
    const faceCenterX = mirroredX + box.width / 2;
    const faceCenterY = box.y + box.height / 2;

    const centerX = canvasRef.current.width / 2;
    const centerY = canvasRef.current.height / 2;

    // Na šírke robíme radius
    const radiusX = w * ellipseMultX; // 0.15
    const radiusY = radiusX * ellipseRatio; // 1.5

    const nx = (faceCenterX - centerX) / radiusX;
    const ny = (faceCenterY - centerY) / radiusY;

    return nx * nx + ny * ny <= 1;
  };

  /**
   * checkFaceSize
   */
  const checkFaceSize = (d: faceapi.FaceDetection, w: number): FaceSizeStatus => {
    const box = d.box;
    const faceW = box.width;
    const faceH = box.height;

    const ellipseW = (w * ellipseMultX) * 2;
    const ellipseH = ellipseW * ellipseRatio;

    const ratioW = faceW / ellipseW;
    const ratioH = faceH / ellipseH;
    const ratio = Math.min(ratioW, ratioH);

    if (ratio < minRatio) return "small";
    else if (ratio > maxRatio) return "big";
    return "ok";
  };

  /**
   * 6) Vykreslenie bounding boxu
   */
  const drawDetections = (detections: faceapi.FaceDetection[]) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = videoRef.current!.videoWidth;
    canvas.height = videoRef.current!.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    detections.forEach((d) => {
      const box = d.box;
      const mirroredX = canvas.width - (box.x + box.width);

      const inside = isFaceInsideEllipse(d, canvas.width);
      const fs = checkFaceSize(d, canvas.width);

      let color = "red";
      let statusText = "OUTSIDE";

      if (inside) {
        if (fs === "small") {
          color = "orange";
          statusText = "INSIDE SMALL";
        } else if (fs === "big") {
          color = "orange";
          statusText = "INSIDE BIG";
        } else {
          color = "#00ff00";
          statusText = "INSIDE OK";
        }
      }

      ctx.lineWidth = 1;
      ctx.strokeStyle = color;
      ctx.strokeRect(mirroredX, box.y, box.width, box.height);

      const score = (d.score * 100).toFixed(0);
      const text = `${score}% ${statusText}`;

      const padding = 5;
      const textHeight = 16;
      const textX = mirroredX;
      const textY = box.y - (textHeight + padding);

      ctx.font = "16px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = color;
      ctx.fillText(text, textX, textY);
    });
  };

  /**
   * Pomocné - vyčistenie canvasu
   */
  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  /**
   * Tlačidlo na toggle bounding box
   */
const toggleGuides = () => {
  if (isCameraOn) {
    setShowGuides((prev) => !prev);
  }
};

  /**
   * Tlačidlá identity
   */
  const saveIdentity = () => {
    console.log("Save Identity (Function Not Implemented)");
  };
  const verifyIdentity = () => {
    console.log("Identity Verification (Function Not Implemented)");
  };

  /**
   * 7) Meníme farbu HTML elipsy podľa stavu
   *    "none" = červená, "small"/"big" = oranžová, "ok" = zelená
   */
  const [ellipseColorStatus, setEllipseColorStatus] = useState<FaceSizeStatus>("none");

  // Preložíme si to na reálnu farbu
  const getEllipseColor = () => {
    switch (ellipseColorStatus) {
      case "none":
        return "rgba(255, 50, 50, 0.8)"; // red
      case "small":
      case "big":
        return "rgba(255, 165, 0, 0.9)"; // orange
      case "ok":
        return "rgba(0, 255, 0, 0.8)"; // green
    }
  };

  /**
   * 8) Funkcia, ktorá spočíta style pre elipsu overlay
   */
  const getEllipseStyle = () => {
    const w = videoRect.width;
    const h = videoRect.height;
    if (!w || !h) {
      return { display: "none" };
    }

    // Polomery
    const rx = w * ellipseMultX; // 0.15
    const ry = rx * ellipseRatio; // 1.5

    // Stred
    const cx = w / 2;
    // Trošku posunieme hore (napr. 5%)
    const cy = h / 2 - h * 0.05;

    // Farbu voláme cez getEllipseColor()
    const borderColor = getEllipseColor() || "rgba(255, 50, 50, 0.8)";

    return {
      position: "absolute" as const,
      width: `${rx * 2}px`,
      height: `${ry * 2}px`,
      left: `${cx - rx}px`,
      top: `${cy - ry}px`,
      border: `3px dashed ${borderColor}`,
      borderRadius: "50%",
      pointerEvents: "none" as const,
    };
  };

  /**
   * Render
   */
  return (
    <div className="video-wrapper" style={{ position: "relative" }}>
      <div className="video-container" style={{ position: "relative", display: "inline-block" }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ maxWidth: "100%" }}
        />

        {/* Canvas na bounding boxy */}
        <canvas
          ref={canvasRef}
          className={showGuides && isCameraOn ? "" : "hidden"}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
          }}
        />

        {/* Overlay elipsa ako HTML div, s farbou podľa ellipseColorStatus */}
        <div
          className="ellipse-overlay"
          style={getEllipseStyle()}
        />
      </div>

      {/* Text ohľadom stavu tváre */}
      <div
        className="face-status-text"
        style={{ color: infoColor, marginTop: "1rem" }}
      >
        {infoText}
      </div>

      {/* Ovládacie tlačidlá */}
      <Controls
        onStartVideo={toggleVideo}
        onSaveIdentity={saveIdentity}
        onVerifyIdentity={verifyIdentity}
        isCameraOn={isCameraOn}
        onToggleGuides={toggleGuides}
        showGuides={showGuides}
      />
    </div>
  );
};

export default VideoSection;
