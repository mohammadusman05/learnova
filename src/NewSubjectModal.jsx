import React, { useState, useEffect, useRef } from 'react';
import { ME } from './utils.js';
const NewSubjectModal = ({ onSave, onClose }) => {
  const [name,setName]=useState("");
  const [emoji,setEmoji]=useState("📚");
  const emojis=["📚","📊","🔬","💻","🤖","🧬","📐","🌍","🎨","⚙️","🧪","📖"];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">New Subject</div>
        <div className="modal-sub">Create a new subject to organise your lectures</div>
        <div className="card-label">CHOOSE AN ICON</div>
        <div className="f fw g8 mb16">
          {emojis.map(e=>(
            <div key={e} onClick={()=>setEmoji(e)}
              style={{width:40,height:40,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,cursor:"pointer",background:emoji===e?"#fff5f4":"#f1f5f9",border:`2px solid ${emoji===e?"#ff6f61":"transparent"}`,transition:"all 0.15s"}}>
              {e}
            </div>
          ))}
        </div>
        <div className="card-label">SUBJECT NAME</div>
        <input className="input-full mb20" placeholder="e.g. Machine Learning, Data Structures..."
          value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&name.trim()&&onSave(name.trim(),emoji)}
          style={{display:"block"}}/>
        <div className="f g12">
          <button className="btn btn-primary" onClick={()=>name.trim()&&onSave(name.trim(),emoji)} disabled={!name.trim()}>Create Subject</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// MASTERY RING
// ============================================================
export default NewSubjectModal;
