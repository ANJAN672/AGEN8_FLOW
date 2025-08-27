import React, { useEffect, useRef, useState } from 'react';

interface PerformanceMonitorProps {
  componentName: string;
  enabled?: boolean;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ 
  componentName, 
  enabled = false // Disabled by default to remove annoying debug info
}) => {
  // Performance monitoring is now disabled by default
  // Only enable in development when explicitly needed
  return null;
};