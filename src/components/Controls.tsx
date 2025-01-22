"use client";
import React from "react";
import "../styles/Controls.css";

interface ControlsProps {
  onStartVideo: () => void;
  onSaveIdentity: () => void;
  onVerifyIdentity: () => void;
  isCameraOn: boolean;
  onToggleGuides: () => void;
  showGuides: boolean;
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
      <button className="btn btn-primary" onClick={onStartVideo}>
        <i className={`fas ${isCameraOn ? "fa-stop" : "fa-camera"}`} />
        <span>{isCameraOn ? "Stop Camera" : "Start Camera"}</span>
      </button>

      <button className="btn btn-secondary" onClick={onToggleGuides}>
        <i className={`fas ${showGuides ? "fa-eye-slash" : "fa-eye"}`} />
        <span>{showGuides ? "Hide Boxes" : "Show Boxes"}</span>
      </button>

      {/*
      <button className="btn btn-success" onClick={onSaveIdentity}>
        <i className="fas fa-user-plus"></i>
        <span>Save Identity</span>
      </button>
      <button className="btn btn-info" onClick={onVerifyIdentity}>
        <i className="fas fa-user-check"></i>
        <span>Verify Identity</span>
      </button>
      */}
    </div>
  );
};

export default Controls;
