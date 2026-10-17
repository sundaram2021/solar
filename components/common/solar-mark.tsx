import React from "react";

interface SolarMarkProps {
  className?: string;
}

export function SolarMark({ className = "" }: SolarMarkProps) {
  return (
    <span className={`solar-mark ${className}`} aria-hidden="true">
      <span />
    </span>
  );
}
