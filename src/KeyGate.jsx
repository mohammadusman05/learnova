import React, { useState, useEffect, useRef } from 'react';
const KeyGate = ({ onUnlock, logo }) => {
  const [key,setKey]=useState("");
  const [show,setShow]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const verify = async () => {
    if(!key.trim()){setError("Please enter your Anthropic API key.");return;}
    setLoading(true);setError("");
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":key.trim(),"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:10,messages:[{role:"user",content:"hi"}]})});
      if(res.status===401){setError("Invalid API key. Please check and try again.");setLoading(false);return;}
      onUnlock(key.trim());
    } catch(e){ onUnlock(key.trim()); }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#fff9f8 0%,#f5f5f5 50%,#fff3f2 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{position:"fixed",top:"10%",left:"15%",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,111,97,0.1),transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:"15%",right:"10%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(38,50,56,0.06),transparent 70%)",pointerEvents:"none"}}/>
      <div style={{width:"100%",maxWidth:460,position:"relative",zIndex:1}}>
        <div className="f ac jc mb24" style={{flexDirection:"column",gap:14}}>
          <div style={{textAlign:"center"}}>
            <img src={logo} alt="Learnova" style={{height:64,width:"auto",marginBottom:8}}/>
            <div style={{fontSize:10,color:"#94a3b8",letterSpacing:"3px",fontFamily:"var(--mono)"}}>AI LEARNING OPERATING SYSTEM</div>
          </div>
        </div>
        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:20,padding:36,boxShadow:"0 20px 60px rgba(0,0,0,0.1)"}}>
          <div style={{fontSize:17,fontWeight:700,marginBottom:6,color:"#0f172a"}}>Welcome 👋</div>
          <div style={{fontSize:13,color:"#64748b",fontFamily:"var(--mono)",marginBottom:24,lineHeight:1.7}}>Enter your Anthropic API key to unlock all AI features. Stays in your browser only — never saved, never shared.</div>
          <div style={{marginBottom:16,position:"relative",overflow:"hidden",borderRadius:12}}>
            <input type={show?"text":"password"} placeholder="Enter your Anthropic API key..."
              value={key} onChange={e=>setKey(e.target.value)} onKeyDown={e=>e.key==="Enter"&&verify()}
              style={{width:"100%",background:"#f8fafc",border:`1.5px solid ${error?"#dc2626":"#e2e8f0"}`,borderRadius:12,padding:"13px 48px 13px 16px",color:"#0f172a",fontFamily:"var(--mono)",fontSize:13,outline:"none",transition:"all 0.2s"}}
              onFocus={e=>{e.target.style.borderColor="#ff6f61";e.target.style.boxShadow="0 0 0 3px rgba(255,111,97,0.12)";}}
              onBlur={e=>{e.target.style.borderColor=error?"#dc2626":"#e2e8f0";e.target.style.boxShadow="none";}}/>
            <div style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:16,userSelect:"none"}} onClick={()=>setShow(s=>!s)}>{show?"🙈":"👁️"}</div>
          </div>
          {error&&<div style={{fontSize:12,color:"#dc2626",fontFamily:"var(--mono)",marginBottom:16,padding:"10px 14px",background:"#fef2f2",borderRadius:8,border:"1px solid #fecaca"}}>{error}</div>}
          <button className="btn btn-primary btn-lg" style={{width:"100%",justifyContent:"center"}} onClick={verify} disabled={!key.trim()||loading}>
            {loading?<><div className="spin" style={{borderTopColor:"#fff"}}/>Verifying...</>:<>🚀 Launch Learnova</>}
          </button>
          <div style={{marginTop:20,padding:14,background:"linear-gradient(135deg,#fff9f8,#fff3f2)",borderRadius:12,border:"1px solid #ffcdc9"}}>
            <div style={{fontSize:10,color:"#e8503f",letterSpacing:"1.5px",fontFamily:"var(--mono)",marginBottom:6,fontWeight:700}}>DON'T HAVE A KEY?</div>
            <div style={{fontSize:12,color:"#475569",lineHeight:1.7}}>Get a free API key from <strong>console.anthropic.com</strong> → Sign up → API Keys → Create Key</div>
          </div>
        </div>
        <div style={{textAlign:"center",marginTop:16,fontSize:11,color:"#94a3b8",fontFamily:"var(--mono)"}}>🔒 Key stays in browser memory only · Never saved</div>
      </div>
    </div>
  );
};

// ============================================================
// NEW SUBJECT MODAL
// ============================================================
export default KeyGate;
