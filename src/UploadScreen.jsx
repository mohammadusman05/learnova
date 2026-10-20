import React, { useState, useEffect, useRef } from 'react';
import { graphEngine, exJSON } from './utils.js';
import { EXTRACT_PROMPT, MERGE_PROMPT, stripRepeatedLines, splitIntoPartsWithOffsets, combineConcepts, planMerge, conceptDocIds, joinPagesWithMarkers, removePageMarkers } from './conceptExtraction.js';
import { linkNewDocument } from './prereqLinks.js';
import { LECTURE_GUARD } from './privacy.js';
import { extractPdfText, looksScanned } from './pdfText.js';
const UploadScreen = ({ subject, onUpdate, apiKey }) => {
  const [drag,setDrag]=useState(false);
  const [text,setText]=useState("");
  const [loading,setLoading]=useState(false);
  const [step,setStep]=useState("");
  const [error,setError]=useState("");
  const [result,setResult]=useState(null);
  const [imgPreview,setImgPreview]=useState(null);
  const [currentFileName,setCurrentFileName]=useState("Pasted Text");
  const fileRef=useRef();

  // ── Claude text API ──
  const callClaude=async(sys,usr,mt=1500,temperature)=>{
    const body={model:"claude-haiku-4-5-20251001",max_tokens:mt,system:sys,messages:[{role:"user",content:usr}]};
    if(temperature!==undefined) body.temperature=temperature;
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify(body)
    });
    const d=await res.json();
    if(d.error) throw new Error(d.error.message||"API error");
    return d.content?.[0]?.text||"";
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
    const d=await res.json();
    if(d.error) throw new Error(d.error.message||"API error");
    return d.content?.[0]?.text||"";
  };

  // ── FILE ROUTER ──
  const handleFile=async(file)=>{
    if(!file) return;
    setError("");
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
          // 1. Read the PDF's own text layer in the browser (same text every time, whole PDF)
          let local=null;
          try{ local=await extractPdfText(e.target.result); }catch{ local=null; }
          if(local && !looksScanned(local.text, local.numPages)){
            await processText(local.text, file.name, 'PDF', {pages: local.pages});
            return;
          }
          // 2. Scanned PDF (pages are photos, no selectable text) → ask Claude to read it
          // Convert PDF to base64
          const bytes=new Uint8Array(e.target.result);
          let binary="";
          for(let i=0;i<bytes.byteLength;i++) binary+=String.fromCharCode(bytes[i]);
          const b64=btoa(binary);
          setStep("Scanned PDF — reading pages with AI...");
          // ...
          const res=await fetch("https://api.anthropic.com/v1/messages",{
            method:"POST",
            headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
            body:JSON.stringify({
              model:"claude-haiku-4-5-20251001",
              max_tokens:16000,
              temperature:0,
              messages:[{role:"user",content:[
                {type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},
                {type:"text",text:"Extract all the text content from this PDF document. Return only the raw text, preserving paragraph structure. "+LECTURE_GUARD}
              ]}]
            })
          });
          const d=await res.json();
          if(d.error) throw new Error(d.error.message||"API error");
          const extracted=d.content?.[0]?.text||"";
          if(!extracted||extracted.length<30){
            setStep(""); setLoading(false);
            alert("Could not read this PDF. Please open it, select all (Ctrl+A), copy (Ctrl+C) and paste in the text box below.");
            return;
          }
          await processText(extracted, file.name, 'PDF', {truncated: d.stop_reason==="max_tokens"});
        } catch(err){ setError("PDF Error: "+err.message); setStep(""); setLoading(false); }
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
        } catch(err){ setError("Word Error: "+err.message); setStep(""); setLoading(false); }
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
        } catch(err){ setError("File Error: "+err.message); setStep(""); setLoading(false); }
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
        } catch(err){ setError("Image Error: "+err.message); setStep(""); setLoading(false); }
      };
      reader.readAsDataURL(file); return;
    }

    alert(`Unsupported file type: .${ext}`);
  };

  // ── CONCEPT EXTRACTION (TA point 6: concept granularity) ──
  // 1. remove repeated lines (watermarks/footers)  2. split into parts
  // 3. extract concepts from every part  4. combine  5. merge with existing concepts
  // 6. save full text  7. prerequisite links inside this PDF and to earlier PDFs, each checked (point 12)
  const processText=async(lec, fileName='Pasted Text', fileType='TEXT', opts={})=>{
    setLoading(true); setError(""); setStep("Analysing content...");
    const docId = `doc_${Date.now()}`;
    try{
      // Part 4 — read the whole document (for PDFs, also remember where each page starts — point 11)
      let cleanText, pageStarts = null;
      if(Array.isArray(opts.pages) && opts.pages.length){
        const r = removePageMarkers(stripRepeatedLines(joinPagesWithMarkers(opts.pages)));
        cleanText = r.text; pageStarts = r.pageStarts;
      } else cleanText = stripRepeatedLines(lec);
      const partsMeta = splitIntoPartsWithOffsets(cleanText, 6000);
      const parts = partsMeta.map(p=>p.text);
      // point 11: where in this document a concept was found (used to find its passages later)
      const anchorsFor = (c) => (c.parts||[]).filter(i=>partsMeta[i]).map(i=>({docId, start:partsMeta[i].start, end:partsMeta[i].end}));
      if(!parts.length) throw new Error("No readable text found.");

      // Parts 2–3 — extract from every part (3 parts at a time)
      const partResults = new Array(parts.length).fill(null);
      let failedParts = 0, firstError = "", badReply = "";
      // one part: ask, and if the reply is not a valid concept list, ask once more
      const extractPart = async(p, idx)=>{
        for(let attempt=0; attempt<2; attempt++){
          const raw = await callClaude(EXTRACT_PROMPT, `Part ${idx+1} of ${parts.length}:\n\n${p}`+(attempt?"\n\nReply with the JSON only.":""), 2500, 0);
          const parsed = exJSON(raw);
          if(parsed && Array.isArray(parsed.concepts)) return parsed;
          if(!badReply) badReply = (raw||"(empty reply)").replace(/\s+/g," ").trim().slice(0,160);
        }
        return null;
      };
      for(let i=0;i<parts.length;i+=3){
        setStep(`Extracting concepts (part ${Math.min(i+3,parts.length)} of ${parts.length})...`);
        await Promise.all(parts.slice(i,i+3).map(async(p,j)=>{
          try{
            const parsed = await extractPart(p, i+j);
            if(parsed) partResults[i+j] = parsed;
            else failedParts++;
          }catch(err){ failedParts++; if(!firstError) firstError = err.message; }
        }));
      }
      if(failedParts===parts.length) throw new Error(
        firstError || (badReply ? `Could not extract concepts. Claude replied: "${badReply}…"` : "Could not extract concepts. Try with more detailed content.")
      );
      const topic = partResults.find(r=>r?.topic)?.topic || "Lecture";
      const found = combineConcepts(partResults).map((c,i)=>({...c, localId:`n${i+1}`}));
      if(!found.length) throw new Error("No concepts found in this content.");

      // Part 5 — compare with concepts already in the subject
      setStep("Checking for duplicate concepts...");
      const existingNodes = Object.values(subject.graph.nodes||{});
      let llmMerge = {};
      if(existingNodes.length>0 || parts.length>1){
        const eIds = {}; // e1 → real id
        const existingList = existingNodes.map((n,i)=>{ eIds[`e${i+1}`]=n.id; return `e${i+1}: ${n.name} — ${n.definition||""}`; }).join("\n");
        const newList = found.map(c=>`${c.localId}: ${c.name} — ${c.definition}`).join("\n");
        try{
          const raw = await callClaude(MERGE_PROMPT, `NEW:\n${newList}\n\nEXISTING:\n${existingList||"(none)"}`, 2000, 0);
          const parsed = exJSON(raw) || {};
          llmMerge = {
            sameAsExisting: (parsed.sameAsExisting||[]).map(p=>({new:p?.new, existing:eIds[p?.existing]})),
            duplicatesWithinNew: parsed.duplicatesWithinNew||[],
          };
        }catch{ llmMerge = {}; } // exact-name merging still applies
      }
      const plan = planMerge(found, existingNodes, llmMerge);

      setStep("Building knowledge graph...");
      let ng = {...subject.graph, nodes:{...(subject.graph.nodes||{})}};
      const nm = {...subject.mastery};
      const topicId = topic.toLowerCase().replace(/\s+/g,"_");
      const finalId = {};     // localId → node id in the graph
      const mergedIds = new Set();
      let newCount = 0;
      // concepts that are new, or match an existing concept
      found.forEach((c,i)=>{
        const r = plan[c.localId];
        if(r.existing){
          const node = ng.nodes[r.existing];
          const sources = conceptDocIds(node);
          ng = graphEngine.addNode(ng, {...node, sourceDocIds: sources.includes(docId) ? sources : [...sources, docId], anchors:[...(node.anchors||[]), ...anchorsFor(c)]});
          finalId[c.localId] = r.existing; mergedIds.add(r.existing);
        } else if(r.new===c.localId){
          const cid = `${subject.id}_${docId}_c${i+1}`; // unique: includes the document id
          const {localId, parts: _parts, ...fields} = c;
          ng = graphEngine.addNode(ng, {...fields, id:cid, topicId, state:"NOT_LEARNED", sourceDocId:docId, sourceDocIds:[docId], anchors:anchorsFor(c)});
          if(nm[cid]===undefined) nm[cid]=0;
          finalId[c.localId] = cid; newCount++;
        }
      });
      // duplicates inside this document point to the concept they duplicate (and add where they were found)
      found.forEach(c=>{
        const r=plan[c.localId];
        if(r.new && r.new!==c.localId){
          const target = finalId[r.new]; finalId[c.localId] = target;
          if(target && ng.nodes[target]) ng = graphEngine.addNode(ng, {...ng.nodes[target], anchors:[...(ng.nodes[target].anchors||[]), ...anchorsFor(c)]});
        }
      });

      const docNodeIds = [...new Set(Object.values(finalId).filter(Boolean))];

      // Part 4 — save the full text (no 50,000-character cut)
      const docEntry = {
        id: docId,
        name: fileName,
        topic,
        conceptCount: newCount,
        uploadedAt: Date.now(),
        fileType: fileType,
        rawText: cleanText,
        ...(pageStarts ? {pageStarts} : {}), // point 11: page numbers for citations
      };
      const updatedDocs = [...(subject.docs||[]), docEntry];

      // TA point 12 — prerequisite links: inside this PDF + to earlier PDFs, each checked a second time
      let links = { within:0, across:0, dropped:0, reversed:0, unchecked:0, problems:[] };
      try{
        const r = await linkNewDocument(callClaude, ng, updatedDocs, docNodeIds, setStep);
        ng = r.graph; links = r.stats;
      }catch(err){ links.problems = [err.message]; } // concepts are still saved; the warning says what failed

      onUpdate({...subject,graph:ng,mastery:nm,docs:updatedDocs});
      setResult({
        topic,
        count: docNodeIds.length,
        newCount,
        mergedCount: mergedIds.size,
        failedParts,
        totalParts: parts.length,
        truncated: !!opts.truncated,
        links,
        concepts: docNodeIds.map(id=>({...ng.nodes[id], merged: mergedIds.has(id)})),
      });
      setStep("");
    } catch(e){ setError(e.message); setStep(""); }
    setLoading(false);
  };

  if(result) return (
    <div className="fade">
      <div className="section-title">Content Processed ✓</div>
      <div className="section-sub">{result.count} concepts found · {result.newCount} new · {result.mergedCount} already in {subject.name}</div>
      {(result.truncated||result.failedParts>0||result.links?.problems?.length>0||result.links?.unchecked>0)&&(
        <div className="card mb16" style={{borderColor:"#fcd34d",background:"#fffbeb",fontSize:12}}>
          {result.truncated&&<div>⚠ This PDF is very long — only about the first 50 pages of text were read.</div>}
          {result.failedParts>0&&<div>⚠ {result.failedParts} of {result.totalParts} parts could not be read. Upload again to retry.</div>}
          {result.links?.problems?.length>0&&<div>⚠ Some prerequisite links could not be made or checked ({result.links.problems.join(" · ")}). Open Knowledge Graph and click “Re-check links”.</div>}
          {result.links?.unchecked>0&&<div>⚠ {result.links.unchecked} link{result.links.unchecked!==1?"s were":" was"} saved without the second check (marked “not checked”).</div>}
        </div>
      )}
      {result.links&&(
        <div className="card mb16" style={{fontSize:12}}>
          🔗 <b>Prerequisite links:</b> {result.links.within} inside this PDF · {result.links.across} to earlier PDFs · {result.links.dropped} dropped by the check{result.links.reversed>0?` · ${result.links.reversed} direction${result.links.reversed!==1?"s":""} corrected`:""}
        </div>
      )}
      {imgPreview&&<div className="mb16"><img src={imgPreview} alt="Uploaded" style={{maxHeight:120,borderRadius:8,border:"1px solid var(--b1)"}}/></div>}
      <div className="card mb20" style={{borderColor:"#86efac",background:"#f0fdf4"}}>
        <div className="f ac g12 mb20">
          <div style={{width:48,height:48,borderRadius:14,background:"#dcfce7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>✅</div>
          <div><div style={{fontSize:16,fontWeight:700}}>Knowledge graph updated!</div><div className="ts t3 tm">{result.newCount} new concepts added, {result.mergedCount} linked to existing concepts</div></div>
        </div>
        <div className="gauto">
          {result.concepts.map(c=>(<div key={c.id} className="cc"><div className="cc-name">{c.name}{c.merged&&<span className="txs t3 tm" style={{marginLeft:6,fontWeight:500}}>· already in subject</span>}</div><div className="cc-def">{c.definition}</div><div className="mbar"><div className="mfill" style={{width:"0%",background:"#ff6f61"}}/></div></div>))}
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
      {error&&!loading&&(
        <div className="card mb16" style={{borderColor:"#fca5a5",background:"#fef2f2",color:"#b91c1c",fontSize:13}}>
          ⚠ Upload failed — {error}
        </div>
      )}
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
