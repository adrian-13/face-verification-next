"use client";
import React from "react";
import "../styles/Controls.css";

interface ControlsProps {
  onStartVideo: () => void;
  onSaveIdentity: () => void;
  onVerifyIdentity: () => void;
  isCameraOn: boolean;
  onToggleGuides: () => void;  // Prepína vodiace čiary + bounding box
  showGuides: boolean;         // Stav
}

const Controls: React.FC<ControlsProps> = ({
  onStartVideo,
  //onSaveIdentity,
  //onVerifyIdentity,
  isCameraOn,
  onToggleGuides,
  showGuides,
}) => {
  return (
    <div className="controls-container">
      {/* Zapnutie / vypnutie kamery */}
      <button className="btn btn-primary" onClick={onStartVideo}>
        <i className={`fas ${isCameraOn ? "fa-stop" : "fa-camera"}`} />
        <span>{isCameraOn ? "Stop Camera" : "Start Camera"}</span>
      </button>

      {/* Prepínanie vodiacich čiar a bounding boxov */}
      <button className="btn btn-secondary" onClick={onToggleGuides}>
        <i className={`fas ${showGuides ? "fa-eye-slash" : "fa-eye"}`} />
        <span>{showGuides ? "Hide Lines" : "Show Lines"}</span>
      </button>

      {/* Napr. zakomentované tlačidlá */}
      {/*
      <button className="btn btn-success" onClick={onSaveIdentity} disabled>
        <i className="fas fa-user-plus"></i>
        <span>Uložiť identitu</span>
      </button>
      <button className="btn btn-info" onClick={onVerifyIdentity} disabled>
        <i className="fas fa-user-check"></i>
        <span>Overiť identitu</span>
      </button>
      */}
    </div>
  );
};

export default Controls;
