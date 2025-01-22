"use client";

import React from "react";
import "../styles/Header.css";

const Header: React.FC = () => {
  return (
    <header className="header">
      <h1>Identity Verification</h1>
      <p className="subtitle">Secure and Fast Identity Verification Using Your Face</p>
    </header>
  );
};

export default Header;
