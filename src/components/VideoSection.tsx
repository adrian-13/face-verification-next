"use client";

import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";
import "../styles/VideoSection.css";
import Controls from "./Controls";

type FaceSizeStatus = "none" | "small" | "big" | "ok";

const VideoSection: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Stavy pre modely a kameru
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);

  // Toggle, či skryjeme canvas (ovál + boxy)
  const [showGuides, setShowGuides] = useState(true);

  // **Tu meníme počiatočný text na "Camera is off"**
  const [infoText, setInfoText] = useState("Camera is off");
  const [infoColor, setInfoColor] = useState("white");

  // Parametre oválu
  let centerX = 0;
  let centerY = 0;
  let radiusX = 0;
  let radiusY = 0;

  // Prahy
  const minRatio = 0.6;
  const maxRatio = 0.7;

  // ---------------------------------------------------------
  // 1) Načítanie modelov FaceAPI
  // ---------------------------------------------------------
  useEffect(() => {
    if (typeof window !== "undefined") {
      Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      ])
        .then(() => {
          console.log("Models Successfully Loaded");
          setModelsLoaded(true);
        })
        .catch((error) => {
          console.error("Error Loading Models", error);
        });
    }
  }, []);

  // ---------------------------------------------------------
  // 2) Handlovanie resize
  // ---------------------------------------------------------
  useEffect(() => {
    const handleResize = () => {
      if (showGuides && isCameraOn) {
        drawFaceGuide("none");
      } else {
        clearCanvas();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isCameraOn, showGuides]);

  // ---------------------------------------------------------
  // 3) Zapnutie / vypnutie videa
  // ---------------------------------------------------------
  const startVideo = async () => {
    if (!modelsLoaded) {
      console.warn("Models Not Loaded");
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

          // Nastavíme text, kým nezačne detekcia
          setInfoText("Align Your Face to the Center");
          setInfoColor("white");

          if (showGuides) {
            drawFaceGuide("none");
          } else {
            clearCanvas();
          }

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

    // Kamera je off => text = "Camera is off"
    setInfoText("Camera is off");
    setInfoColor("white");
  };

  const toggleVideo = () => {
    if (isCameraOn) {
      stopVideo();
    } else {
      startVideo();
    }
  };

  // ---------------------------------------------------------
  // 3b) Toggle pre skrytie canvasu (ovál + bounding box)
  // ---------------------------------------------------------
  const toggleGuidesHidden = () => {
    setShowGuides((prev) => !prev);
  };

  // ---------------------------------------------------------
  // 4) Kreslenie oválu
  // ---------------------------------------------------------
  const drawFaceGuide = (sizeStatus: FaceSizeStatus) => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    centerX = canvas.width / 2;
    centerY = canvas.height / 2;
    radiusX = canvas.width * 0.2;
    radiusY = radiusX * 1.6;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let ellipseColor = "rgba(255, 50, 50, 0.8)"; // default: červená
    switch (sizeStatus) {
      case "none":
        ellipseColor = "rgba(255, 50, 50, 0.8)";
        break;
      case "small":
      case "big":
        ellipseColor = "rgba(255, 200, 0, 0.9)";
        break;
      case "ok":
        ellipseColor = "rgba(0, 255, 0, 0.8)";
        break;
    }

    // Elipsa
    ctx.strokeStyle = ellipseColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.stroke();

    // Vodiace čiary, ak showGuides = true
    if (showGuides) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.setLineDash([5, 5]);

      const eyeLineY = centerY - radiusY * 0.2;
      // Horizontálna čiara
      ctx.beginPath();
      ctx.moveTo(centerX - radiusX * 0.8, eyeLineY);
      ctx.lineTo(centerX + radiusX * 0.8, eyeLineY);
      ctx.stroke();

      // Vertikálna čiara
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radiusY * 0.8);
      ctx.lineTo(centerX, centerY + radiusY * 0.8);
      ctx.stroke();

      // Bodky pre oči
      const drawEyePoint = (x: number, y: number) => {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.fill();
      };
      drawEyePoint(centerX - radiusX * 0.4, eyeLineY);
      drawEyePoint(centerX + radiusX * 0.4, eyeLineY);
    }
  };

  // ---------------------------------------------------------
  // 5) Pomocné funkcie
  // ---------------------------------------------------------
  const isFaceInsideEllipse = (d: faceapi.FaceDetection, w: number) => {
    const box = d.box;
    const mirroredX = w - (box.x + box.width);
    const faceCenterX = mirroredX + box.width / 2;
    const faceCenterY = box.y + box.height / 2;

    const nx = (faceCenterX - centerX) / radiusX;
    const ny = (faceCenterY - centerY) / radiusY;
    return nx * nx + ny * ny <= 1;
  };

  const checkFaceSize = (d: faceapi.FaceDetection, w: number) => {
    const box = d.box;
    const faceW = box.width;
    const faceH = box.height;

    const ellW = 2 * radiusX;
    const ellH = 2 * radiusY;

    const ratioW = faceW / ellW;
    const ratioH = faceH / ellH;
    const ratio = Math.min(ratioW, ratioH);

    if (ratio < minRatio) return "small";
    else if (ratio > maxRatio) return "big";
    return "ok";
  };

  // ---------------------------------------------------------
  // 6) detectFaces (loop)
  // ---------------------------------------------------------
  const detectFaces = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const detections = await faceapi.detectAllFaces(
      videoRef.current,
      new faceapi.SsdMobilenetv1Options()
    );

    let sizeStatus: FaceSizeStatus = "none";
    let newText = "Align Your Face to the Center";
    let newColor = "white";

    if (detections.length === 0) {
      sizeStatus = "none";
      newText = "No Face Detected";
      newColor = "red";
    } else if (detections.length > 1) {
      sizeStatus = "none";
      newText = "Multiple Faces Detected - Please Only One Person";
      newColor = "red";
    } else {
      // 1 tvár
      const detection = detections[0];
      const cw = canvasRef.current!.width;
      const inside = isFaceInsideEllipse(detection, cw);

      if (!inside) {
        sizeStatus = "none";
        newText = "Place Your Face in the Marked Oval";
        newColor = "red";
      } else {
        // inside
        const s = checkFaceSize(detection, cw); // small | big | ok
        sizeStatus = s as FaceSizeStatus;
        switch (s) {
          case "small":
            newText = "Move Closer";
            newColor = "orange";
            break;
          case "big":
            newText = "Move Further Away";
            newColor = "orange";
            break;
          case "ok":
            newText = "Great, You Are in the Correct Position";
            newColor = "green";
            break;
        }
      }
    }

    setInfoText(newText);
    setInfoColor(newColor);

    drawFaceGuide(sizeStatus);

    if (showGuides) {
      drawDetections(detections);
    }

    requestAnimationFrame(detectFaces);
  };

  // ---------------------------------------------------------
  // 7) Vykreslenie bounding boxu
  // ---------------------------------------------------------
  const drawDetections = (detections: faceapi.FaceDetection[]) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    detections.forEach((d) => {
      const c = canvasRef.current!;
      const box = d.box;
      const mirroredX = c.width - (box.x + box.width);

      const inside = isFaceInsideEllipse(d, c.width);
      const fs = checkFaceSize(d, c.width);

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

  // ---------------------------------------------------------
  // clearCanvas
  // ---------------------------------------------------------
  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  // ---------------------------------------------------------
  // Tlačidlá identity (zakomentované alebo neaktívne)
  // ---------------------------------------------------------
  const saveIdentity = () => {
    console.log("Save Identity (Function Not Implemented)");
  };
  const verifyIdentity = () => {
    console.log("Identity Verification (Function Not Implemented)");
  };

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------
  return (
    <div className="video-wrapper">
      <div className="video-container">
        <video ref={videoRef} autoPlay muted playsInline />
        <canvas 
          ref={canvasRef}
          className={!showGuides ? "hidden" : ""}
        />
      </div>

      {/** 
       * Text o stave, farba podľa infoColor
       */}
      <div className="face-status-text" style={{ color: infoColor }}>
        {infoText}
      </div>

      <Controls
        onStartVideo={toggleVideo}
        onSaveIdentity={saveIdentity}
        onVerifyIdentity={verifyIdentity}
        isCameraOn={isCameraOn}
        onToggleGuides={toggleGuidesHidden}
        showGuides={showGuides}
      />
    </div>
  );
};

export default VideoSection;
