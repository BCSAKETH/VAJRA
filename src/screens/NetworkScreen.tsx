import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { mockGraphNodes, mockGraphEdges, appendAuditLog } from "../mockData";
import {
  Network,
  Sparkles,
  Info,
  SlidersHorizontal,
  Workflow,
  Crosshair,
  MapPin,
  Radio,
} from "lucide-react";

export const NetworkScreen: React.FC = () => {
  const { lang, badgeNumber, selectedFirNo } = useApp();
  const [selectedNodeId, setSelectedNodeId] = useState<string>("subhash");
  const [filterType, setFilterType] = useState<
    "All" | "Person" | "FIR" | "Location" | "Syndicate"
  >("All");

  // Pathfinder State
  const [pathStart, setPathStart] = useState("subhash");
  const [pathEnd, setPathEnd] = useState("warehouse");
  const [pathfinderActive, setPathfinderActive] = useState(false);
  const [showPathAlert, setShowPathAlert] = useState(false);

  // Dynamic network states
  const [nodes, setNodes] = useState<any[]>(mockGraphNodes);
  const [edges, setEdges] = useState<any[]>(mockGraphEdges);
  const [activeFirData, setActiveFirData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState("");

  const handleSearchSuspectNetwork = async (suspectName: string) => {
    if (!suspectName.trim()) return;
    try {
      setIsLoading(true);
      const token = localStorage.getItem("vajra_token");
      const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      };
      const netRes = await fetch(`http://localhost:8000/api/suspects/network/${encodeURIComponent(suspectName)}`, { headers });
      if (netRes.ok) {
        const netData = await netRes.json();
        
        const positionedNodes = netData.nodes.map((node: any, index: number) => {
          if (node.id === "suspect_node") {
            return { ...node, x: "50%", y: "50%" };
          }
          const angle = (index / netData.nodes.length) * 2 * Math.PI;
          const radius = 35; // %
          const x = 50 + radius * Math.cos(angle);
          const y = 50 + radius * Math.sin(angle);
          return {
            ...node,
            x: `${Math.round(x)}%`,
            y: `${Math.round(y)}%`
          };
        });

        setNodes(positionedNodes);
        setEdges(netData.edges);
        if (positionedNodes.length > 0) {
          setSelectedNodeId(positionedNodes[0].id);
          setPathStart(positionedNodes[0].id);
          if (positionedNodes.length > 1) {
            setPathEnd(positionedNodes[1].id);
          }
        }
      }
    } catch (err) {
      console.error("Error searching suspect network:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchNetwork = async () => {
      if (!selectedFirNo) {
        setNodes(mockGraphNodes);
        setEdges(mockGraphEdges);
        setSelectedNodeId("subhash");
        setPathStart("subhash");
        setPathEnd("warehouse");
        setActiveFirData(null);
        return;
      }

      try {
        setIsLoading(true);
        const token = localStorage.getItem("vajra_token");
        const headers = {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        };

        // 1. Fetch active case details
        const firRes = await fetch(`http://localhost:8000/api/firs/${selectedFirNo}`, { headers });
        if (!firRes.ok) throw new Error("Failed to fetch FIR details");
        const firData = await firRes.json();
        setActiveFirData(firData);

        // 2. Query cross-case suspect connection network
        const netRes = await fetch(`http://localhost:8000/api/suspects/network/${encodeURIComponent(firData.accusedName)}`, { headers });
        if (netRes.ok) {
          const netData = await netRes.json();
          
          const positionedNodes = netData.nodes.map((node: any, index: number) => {
            if (node.id === "suspect_node") {
              return { ...node, x: "50%", y: "50%" };
            }
            const angle = (index / netData.nodes.length) * 2 * Math.PI;
            const radius = 35; // %
            const x = 50 + radius * Math.cos(angle);
            const y = 50 + radius * Math.sin(angle);
            return {
              ...node,
              x: `${Math.round(x)}%`,
              y: `${Math.round(y)}%`
            };
          });

          setNodes(positionedNodes);
          setEdges(netData.edges);
          if (positionedNodes.length > 0) {
            setSelectedNodeId(positionedNodes[0].id);
            setPathStart(positionedNodes[0].id);
            if (positionedNodes.length > 1) {
              setPathEnd(positionedNodes[1].id);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching GraphRAG network:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNetwork();
  }, [selectedFirNo]);

  const chosenNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  const handleSynthesizeLink = () => {
    appendAuditLog({
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      badgeId: badgeNumber || "KSP-2026",
      action: "Pathfinder Engine Synthesis",
      queryParam: `Tracing link: ${pathStart} -> ${pathEnd}`,
      recordsAccessed: edges.length,
    });
    setPathfinderActive(true);
    setShowPathAlert(true);
    setTimeout(() => setShowPathAlert(false), 5000);
  };

  const selectedNodeObj = nodes.find(n => n.id === selectedNodeId);
  const currentDocs = selectedNodeObj ? {
    desc: selectedNodeObj.desc || "Active system network node. Traced from Karnataka CCTNS relational registry.",
    updated: "Just updated",
    confidence: selectedNodeObj.type === "Person" ? "98% Match" : "Grounded"
  } : {
    desc: "Active system network node. Traced from Karnataka CCTNS relational registry.",
    updated: "N/A",
    confidence: "Grounded",
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in font-sans">
      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-200 pb-4 gap-4 bg-white p-5 rounded-xl shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded text-[11px] font-mono font-bold">
            <Workflow className="w-3.5 h-3.5 text-[#1D4ED8]" />
            <span>VAJRA NETWORK ANALYSIS & PATHFINDER</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight kn-text">
            {lang === "en"
              ? "Multi-Hop Criminal Linkages"
              : "ಬಹು-ಹಂತದ ಅಪರಾಧ ಕೊಂಡಿಗಳು"}
          </h2>
          <p className="text-[12.5px] text-slate-500 max-w-3xl leading-relaxed kn-text">
            {lang === "en"
              ? "Map and analyze relational hubs. Trace the flow of stolen assets, identify coordinated syndicates, and uncover latent structures behind active case incidents."
              : "ಸಂಶಯಾಸ್ಪದ ವ್ಯಕ್ತಿಗಳು, ವಾಹನಗಳು, ಮತ್ತು ಎಫ್‌ಐಆರ್ ದಾಖಲೆಗಳ ನಡುವಿನ ಬಹು-ಹಂತದ ಕೊಂಡಿಗಳನ್ನು ವಿಶ್ಲೇಷಿಸಿ."}
          </p>
        </div>

        {/* Filter Node Buttons */}
        <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg text-[10px] font-bold font-mono">
          {(["All", "Person", "FIR", "Location", "Syndicate"] as const).map(
            (type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1.5 rounded transition-all cursor-pointer ${filterType === type ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"}`}
              >
                {type.toUpperCase()}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Suspect Search Input Bar */}
      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex-1 w-full space-y-1">
          <label className="text-[11px] font-mono font-bold text-slate-400 uppercase">
            {lang === "en" ? "Standalone Suspect Network Query" : "ಶಂಕಿತ ಆರೋಪಿಗಳ ಜಾಲದ ತನಿಖೆ"}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={lang === "en" ? "Enter suspect name (e.g., Rowdy Ramesh)..." : "ಶಂಕಿತ ವ್ಯಕ್ತಿಯ ಹೆಸರು ನಮೂದಿಸಿ..."}
              className="flex-1 max-w-md bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button
              onClick={() => handleSearchSuspectNetwork(inputText)}
              className="bg-[#1D4ED8] hover:bg-blue-800 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              {lang === "en" ? "Search Network" : "ಹುಡುಕಿ"}
            </button>
          </div>
        </div>
      </div>

      {selectedFirNo && (
        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl shadow-sm flex items-start space-x-3 text-indigo-900">
          <Workflow className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-0.5">
            <h4 className="font-bold text-[13px] uppercase tracking-wider font-mono">
              Case-Specific Relational Context Active: {selectedFirNo}
            </h4>
            <p className="text-[11.5px] opacity-80 leading-relaxed font-medium">
              The network graph is currently filtered to display only nodes
              (individuals, vehicles, associates) up to 3 hops away from this
              FIR.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Interactive Map (Col Span 8) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-[13px] font-bold text-slate-900 font-mono uppercase">
                Interactive Relational Map
              </h4>
              <span className="text-[9px] font-bold font-mono text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-100">
                ACTIVE TRACES: {mockGraphEdges.length}
              </span>
            </div>

            {showPathAlert && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-[#ef4444] text-white px-4 py-2 rounded-lg font-mono text-xs font-bold shadow-xl shadow-red-500/20 border border-red-400 flex items-center space-x-2 animate-bounce">
                <Radio className="w-4 h-4 animate-pulse" />
                <span>PATHFINDER PATH CO-ORDINATED WITH ACCUSED</span>
              </div>
            )}

            {/* Interactive Graph Canvas Area - SVG */}
            <div className="bg-slate-950 aspect-[16/10] rounded-xl relative overflow-hidden flex items-center justify-center border border-slate-800">
              <div className="absolute inset-0 opacity-5 pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]"></div>

              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                  <marker
                    id="arrowhead-blue"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#1D4ED8" />
                  </marker>
                  <marker
                    id="arrowhead-red"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#EF4444" />
                  </marker>
                  <marker
                    id="arrowhead-teal"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#10B981" />
                  </marker>
                  <marker
                    id="arrowhead-amber"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#F59E0B" />
                  </marker>
                  <marker
                    id="arrowhead-violet"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#8B5CF6" />
                  </marker>
                  <marker
                    id="arrowhead-gray"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#475569" />
                  </marker>
                </defs>

                {/* Dynamically Render Relational Edges */}
                {edges.map((edge, idx) => {
                  const srcNode = nodes.find(n => n.id === edge.source);
                  const tgtNode = nodes.find(n => n.id === edge.target);
                  if (!srcNode || !tgtNode) return null;

                  const isPath = pathfinderActive && 
                    ((edge.source === pathStart && edge.target === pathEnd) ||
                     (edge.source === "suspect_node" && edge.target === "second_0") ||
                     (edge.source === "suspect_node" && edge.target === "first_0"));

                  return (
                    <line
                      key={`edge-${idx}`}
                      x1={srcNode.x}
                      y1={srcNode.y}
                      x2={tgtNode.x}
                      y2={tgtNode.y}
                      stroke={isPath ? "#EF4444" : "#475569"}
                      strokeWidth={isPath ? "3" : "1.5"}
                      strokeDasharray={tgtNode.type === "FIR" ? "4,4" : undefined}
                      markerEnd="url(#arrowhead-gray)"
                      opacity={isPath ? "1" : "0.5"}
                    />
                  );
                })}
              </svg>

              {/* Nodes Plotting mapped coordinates */}
              {nodes
                .filter(
                  (node) => filterType === "All" || node.type === filterType,
                )
                .map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const isPathNode = pathfinderActive && (node.id === pathStart || node.id === pathEnd || node.id === "suspect_node");

                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all p-2 rounded-lg text-center z-10 ${
                        isSelected
                          ? "ring-4 ring-white/20 scale-110 z-20 bg-slate-900 border border-white/40"
                          : isPathNode
                            ? "bg-slate-900 ring-2 ring-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                            : "bg-slate-950/80 hover:bg-slate-900 border border-slate-800"
                      }`}
                      style={{ left: node.x, top: node.y }}
                    >
                      <div className="flex flex-col items-center justify-center p-1 space-y-1">
                        <span
                          className="w-4 h-4 rounded-full inline-block shrink-0 shadow-sm shadow-black/50"
                          style={{ backgroundColor: node.color }}
                        ></span>
                        <span className="text-[10px] text-white font-mono font-medium truncate max-w-[120px] bg-slate-900/60 px-1 rounded backdrop-blur-sm">
                          {node.label.split(" @")[0].split(" (")[0]}
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>

            {/* Pathfinder Engine Panel */}
            <div className="mt-4 p-4 border-2 border-slate-200 rounded-xl bg-slate-50 relative overflow-hidden">
              <div className="flex items-center space-x-2 mb-3">
                <Network className="w-5 h-5 text-[#ef4444]" />
                <h4 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-wider">
                  Pathfinder Analysis Engine
                </h4>
              </div>
              <p className="text-xs text-slate-600 mb-4 max-w-2xl">
                Trace multi-hop operational chains to prove conspiracies or find
                the direct route from a coordinator to a fencing location.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">
                    Starting Node
                  </label>
                  <select
                    value={pathStart}
                    onChange={(e) => setPathStart(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-mono"
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">
                    Target Node
                  </label>
                  <select
                    value={pathEnd}
                    onChange={(e) => setPathEnd(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-mono"
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleSynthesizeLink}
                  className="w-full h-[38px] bg-[#1D4ED8] hover:bg-[#1D4ED8]/90 text-white rounded-md font-bold text-[11px] uppercase tracking-wider flex items-center justify-center space-x-2 shadow-sm transition-all"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Synthesize Critical Link</span>
                </button>
              </div>

              {pathfinderActive && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-red-800 uppercase font-mono">
                      Identified Critical Pathway
                    </span>
                    <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                      HIGH CONFIDENCE
                    </span>
                  </div>
                  <p className="text-xs text-red-900 leading-relaxed font-medium">
                    {selectedFirNo ? (
                      <span>
                        The identified path exposes the connection. 
                        {" "}<strong>{activeFirData?.accusedName || "Gowda"}</strong> is linked to 
                        {" "}<strong>{nodes.find(n => n.id === pathEnd)?.label || "Co-Accused"}</strong> in the active dossier 
                        {" "}<strong>{selectedFirNo}</strong>.
                      </span>
                    ) : (
                      <span>
                        The identified path exposes the intermediate conduit.{" "}
                        <strong>Ramesh 'Babu' Kumar</strong> serves as the direct
                        link bypass to move stolen electronics from the mastermind{" "}
                        <strong>Subhash Rao</strong> to the{" "}
                        <strong>Yelahanka Warehouse</strong>.
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Target Background Dossier Panel (Right, 4-column layout) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm h-full flex flex-col">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2 mb-4">
              <Info className="w-4 h-4 text-[#1D4ED8]" />
              <span className="kn-text leading-none uppercase tracking-wider">
                Target Background Dossier
              </span>
            </h3>

            {/* Dossier Card */}
            <div className="flex-1 space-y-4">
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <h5 className="text-[14px] font-bold text-slate-900">
                    {chosenNode.label}
                  </h5>
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase mt-1 block">
                    ID: {selectedNodeId}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-1 rounded text-white`}
                  style={{ backgroundColor: chosenNode.color }}
                >
                  {chosenNode.type}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">
                    Operational Identity
                  </span>
                  <div className="text-[13px] font-medium text-slate-800 kn-text leading-relaxed mt-1">
                    {currentDocs.desc}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">
                    Forensic Intel Summary
                  </span>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] font-mono text-slate-600">
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <div className="text-slate-400 mb-0.5">LAST UPDATED</div>
                      <div className="font-bold text-slate-800">
                        {currentDocs.updated}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <div className="text-slate-400 mb-0.5">CONFIDENCE</div>
                      <div className="font-bold text-[#1D4ED8]">
                        {currentDocs.confidence}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Teal Insights Block */}
            <div className="mt-6 border-l-2 border-[#00C6AD] bg-[#00C6AD]/5 rounded-r-xl p-4 shadow-sm">
              <h4 className="text-[11px] uppercase font-mono tracking-widest text-[#00100C] font-bold flex items-center space-x-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#00C6AD]" />
                <span>Active Network Context</span>
              </h4>
              <p className="text-[11.5px] text-slate-600 leading-relaxed font-sans">
                Selecting entities dynamically queries connected nodes. This
                target is structurally linked to{" "}
                {
                  edges.filter(
                    (e) =>
                      e.source === selectedNodeId ||
                      e.target === selectedNodeId,
                  ).length
                }{" "}
                immediate associates in the current matrix.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
