import React, { useState, useEffect, useRef } from 'react';
import { graphEngine, exJSON } from './utils.js';
const UploadScreen = ({ subject, onUpdate, apiKey }) => {
  const [drag,setDrag]=useState(false);
  const [text,setText]=useState("");
  const [loading,setLoading]=useState(false);
  const [step,setStep]=useState("");
  const [result,setResult]=useState(null);
  const [imgPreview,setImgPreview]=useState(null);
  const [currentFileName,setCurrentFileName]=useState("Pasted Text");
  const fileRef=useRef();

  // ── Claude text API ──
  const callClaude=async(sys,usr,mt=1500)=>{
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:mt,system:sys,messages:[{role:"user",content:usr}]})
    });
    const d=await res.json(); return d.content?.[0]?.text||"";
  };

  // ── Claude Vision API ──
  const callClaudeVision=async(b64,mime)=>{
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:2000,
        messages:[{role:"user",content:[
          {type:"image",source:{type:"base64",media_type:mime,data:b64}},
          {type:"text",text:"Extract all readable text from this image. Return only the raw text content, preserving structure as much as possible."}
        ]}]
      })
    });
    const d=await res.json(); return d.content?.[0]?.text||"";
  };

  // ── FILE ROUTER ──
  const handleFile=async(file)=>{
    if(!file) return;
    setCurrentFileName(file.name);

    const ext=file.name.toLowerCase().split(".").pop();

    // ...
    if(["txt","md","html","htm","csv"].includes(ext)){
      const t=await file.text();
      processText(t, file.name, ext.toUpperCase()); return;
    }

    // ...
    if(ext==="pdf"){
      setLoading(true); setStep("Reading PDF...");
      const reader=new FileReader();
      reader.onload=async(e)=>{
        try{
          // Convert PDF to base64
          const bytes=new Uint8Array(e.target.result);
          let binary="";
          for(let i=0;i<bytes.byteLength;i++) binary+=String.fromCharCode(bytes[i]);
          const b64=btoa(binary);
          setStep("Extracting text from PDF with AI...");
          // ...
          const res=await fetch("https://api.anthropic.com/v1/messages",{
            method:"POST",
            headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
            body:JSON.stringify({
              model:"claude-haiku-4-5-20251001",
              max_tokens:3000,
              messages:[{role:"user",content:[
                {type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},
                {type:"text",text:"Extract all the text content from this PDF document. Return only the raw text, preserving paragraph structure."}
              ]}]
            })
          });
          const d=await res.json();
          const extracted=d.content?.[0]?.text||"";
          if(!extracted||extracted.length<30){
            setStep(""); setLoading(false);
            alert("Could not read this PDF. Please open it, select all (Ctrl+A), copy (Ctrl+C) and paste in the text box below.");
            return;
          }
          await processText(extracted, file.name, 'PDF');
        } catch(err){ setStep("PDF Error: "+err.message); setLoading(false); }
      };
      reader.readAsArrayBuffer(file); return;
    }

    // ...
    if(["docx","doc"].includes(ext)){
      setLoading(true); setStep("Reading Word document...");
      const reader=new FileReader();
      reader.onload=async(e)=>{
        try{
          // ...
          const arr=new Uint8Array(e.target.result);
          const decoder=new TextDecoder("utf-8");
          const raw=decoder.decode(arr);
          // ...
          const matches=raw.match(/<w:t[^>]*>([^<]+)<\/w:t>/g)||[];
          let text=matches.map(m=>m.replace(/<[^>]+>/g,"")).join(" ");
          if(text.trim().length>50){
            await processText(text);
          } else {
            // ...
            setStep(""); setLoading(false);
            alert("Could not extract text from this Word file. Please copy-paste the content into the text box below.");
          }
        } catch(err){ setStep("Word Error: "+err.message); setLoading(false); }
      };
      reader.readAsArrayBuffer(file); return;
    }

    // ...
    if(["xlsx","xls","pptx","ppt"].includes(ext)){
      setLoading(true); setStep(`Reading ${ext.toUpperCase()}...`);
      const reader=new FileReader();
      reader.onload=async(e)=>{
        try{
          const decoder=new TextDecoder("utf-8","{ fatal:false }");
          const raw=decoder.decode(new Uint8Array(e.target.result));
          // ...
          const matches=raw.match(/<(?:t|a:t)[^>]*>([^<]+)<\/(?:t|a:t)>/g)||[];
          let text=matches.map(m=>m.replace(/<[^>]+>/g,"")).join(" ");
          if(text.trim().length>30){
            await processText(text, file.name, ext.toUpperCase());
          } else {
            setStep(""); setLoading(false);
            alert("Could not extract text from this file. Please copy-paste the content into the text box below.");
          }
        } catch(err){ setStep("File Error: "+err.message); setLoading(false); }
      };
      reader.readAsArrayBuffer(file); return;
    }

    // ...
    if(["jpg","jpeg","png","webp","gif","bmp"].includes(ext)){
      setLoading(true); setStep("Analysing image with AI Vision...");
      const reader=new FileReader();
      reader.onload=async(e)=>{
        try{
          const dataUrl=e.target.result;
          setImgPreview(dataUrl);
          const b64=dataUrl.split(",")[1];
          const mimeMap={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",gif:"image/gif",bmp:"image/png"};
          const extracted=await callClaudeVision(b64, mimeMap[ext]||"image/jpeg");
          await processText(extracted, file.name, ext.toUpperCase());
        } catch(err){ setStep("Image Error: "+err.message); setLoading(false); }
      };
      reader.readAsDataURL(file); return;
    }

    alert(`Unsupported file type: .${ext}`);
  };

  const processText=async(lec, fileName='Pasted Text', fileType='TEXT')=>{
    setLoading(true); setStep("Analysing content...");
    const docId = `doc_${Date.now()}`;
    try{
      const raw=await callClaude(
        `Extract key concepts from lecture text. Return ONLY valid JSON:\n{"topic":"Topic Name","concepts":[{"id":"c_unique","name":"Name","definition":"One clear sentence","importance":0.8,"difficulty":0.5}],"relationships":[{"source":"id","target":"id","type":"prerequisite"}]}\nRules: 5-15 concepts, unique short ids starting with c_, prerequisite only where genuinely required, JSON only.`,
        `Extract concepts from:\n\n${lec.substring(0,3000)}`
      );
      setStep("Building knowledge graph...");
      const parsed=exJSON(raw);
      if(!parsed?.concepts) throw new Error("Could not extract concepts. Try with more detailed content.");
      let ng={...subject.graph};
      const nm={...subject.mastery};
      const topicId=(parsed.topic||"lecture").toLowerCase().replace(/\s+/g,"_");
      // docId already defined above
      parsed.concepts.forEach(c=>{
        const cid=`${subject.id}_${c.id||"c_"+Date.now()+"_"+Math.random().toString(36).substr(2,5)}`;
        const concept={...c,id:cid,topicId,state:"NOT_LEARNED",sourceDocId:docId};
        ng=graphEngine.addNode(ng,concept);
        if(nm[cid]===undefined) nm[cid]=0;
      });
      (parsed.relationships||[]).forEach(r=>{
        const sid=`${subject.id}_${r.source}`, tid=`${subject.id}_${r.target}`;
        if(ng.nodes[sid]&&ng.nodes[tid]) ng=graphEngine.addEdge(ng,sid,tid,r.type||"prerequisite");
      });
      // ...
      const existingNames = new Set(Object.values(ng).map ? [] : Object.values(subject.graph.nodes).map(n=>n.name.toLowerCase()));
      const newConceptCount = parsed.concepts.filter(c=>!existingNames.has(c.name.toLowerCase())).length;
      const docEntry = {
        id: docId,
        name: fileName,
        topic: parsed.topic,
        conceptCount: newConceptCount,
        uploadedAt: Date.now(),
        fileType: fileType,
        rawText: lec.substring(0, 50000),
      };
      const updatedDocs = [...(subject.docs||[]), docEntry];
      onUpdate({...subject,graph:ng,mastery:nm,docs:updatedDocs});
      setResult({topic:parsed.topic,count:parsed.concepts.length,concepts:parsed.concepts});
      setStep("");
    } catch(e){ setStep(`Error: ${e.message}`); }
    setLoading(false);
  };

  if(result) return (
    <div className="fade">
      <div className="section-title">Content Processed ✓</div>
      <div className="section-sub">{result.count} concepts added to {subject.name}</div>
      {imgPreview&&<div className="mb16"><img src={imgPreview} alt="Uploaded" style={{maxHeight:120,borderRadius:8,border:"1px solid var(--b1)"}}/></div>}
      <div className="card mb20" style={{borderColor:"#86efac",background:"#f0fdf4"}}>
        <div className="f ac g12 mb20">
          <div style={{width:48,height:48,borderRadius:14,background:"#dcfce7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>✅</div>
          <div><div style={{fontSize:16,fontWeight:700}}>Knowledge graph updated!</div><div className="ts t3 tm">{result.count} concepts added with dependency relationships</div></div>
        </div>
        <div className="gauto">
          {result.concepts.map(c=>(<div key={c.id} className="cc"><div className="cc-name">{c.name}</div><div className="cc-def">{c.definition}</div><div className="mbar"><div className="mfill" style={{width:"0%",background:"#ff6f61"}}/></div></div>))}
        </div>
      </div>
      <button className="btn btn-secondary" onClick={()=>{setResult(null);setText("");setImgPreview(null);setCurrentFileName("Pasted Text");}}>+ Add Another File</button>
    </div>
  );

  const FORMATS=[
    {icon:"📄",label:"Text",types:"TXT · MD · HTML · CSV",color:"#16a34a"},
    {icon:"📕",label:"PDF",types:"PDF",color:"#e8503f"},
    {icon:"📘",label:"Word",types:"DOCX · DOC",color:"#2563eb"},
    {icon:"📗",label:"Spreadsheet",types:"XLSX · PPTX",color:"#d97706"},
    {icon:"🖼️",label:"Image",types:"JPG · PNG · WEBP",color:"#7c3aed"},
  ];

  return (
    <div className="fade">
      <div className="section-title">Ingest Content</div>
      <div className="section-sub">Adding to: <strong>{subject.emoji} {subject.name}</strong></div>
      <div className="f fw g8 mb12">
        {FORMATS.map(f=>(
          <div key={f.label} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:20,background:"#fff",border:"1px solid var(--b1)",fontSize:10,fontWeight:600}}>
            <span style={{fontSize:12}}>{f.icon}</span><span style={{color:f.color}}>{f.types}</span>
          </div>
        ))}
      </div>
      <div className={`uzone mb20 ${drag?"drag":""}`}
        onClick={()=>fileRef.current.click()}
        onDragOver={e=>{e.preventDefault();setDrag(true)}}
        onDragLeave={()=>setDrag(false)}
        onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}>
        <input ref={fileRef} type="file"
          accept=".txt,.md,.html,.htm,.csv,.pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.jpg,.jpeg,.png,.webp,.gif,.bmp"
          style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
        <div style={{fontSize:32,marginBottom:8}}>📂</div>
        <div style={{fontSize:15,fontWeight:700,marginBottom:4,color:"var(--t1)"}}>Drop any file here</div>
        <div className="ts t3 tm">PDF · Word · Excel · PowerPoint · Images · Text · or click to browse</div>
      </div>
      <div className="card mb20">
        <div className="card-label">OR PASTE TEXT DIRECTLY</div>
        <textarea className="input-full" rows={6}
          placeholder="Paste your lecture notes, textbook excerpt, or any study material here..." rows={4}
          value={text} onChange={e=>setText(e.target.value)}/>
      </div>
      {loading
        ?<div className="loading"><div className="spin"/><span>{step}</span></div>
        :<button className="btn btn-primary btn-lg" onClick={()=>processText(text,'Pasted Text','TEXT')} disabled={!text.trim()}>⚡ Extract Concepts & Build Graph</button>
      }
    </div>
  );
};



// ============================================================
// LIBRARY SCREEN
// ============================================================
export default UploadScreen;
