import React, { useState, useEffect, useRef } from 'react';
import { ME, subjectAvg } from './utils.js';
const Ring = ({ score, size=56, sw=4 }) => {
  const r=(size-sw*2)/2, circ=2*Math.PI*r;
  const {color}=ME.getLevel(score);
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)",flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={circ} strokeDashoffset={circ-(score/100)*circ} strokeLinecap="round"
        style={{transition:"stroke-dashoffset 0.6s ease"}}/>
    </svg>
  );
};

// Subject avg mastery

// ============================================================
// ...
// ============================================================
export default Ring;
