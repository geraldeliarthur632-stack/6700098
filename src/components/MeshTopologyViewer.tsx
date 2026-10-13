import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Share2, 
  Layers, 
  Cpu, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  Zap, 
  Bluetooth, 
  Wifi, 
  Waves, 
  Globe, 
  RefreshCw, 
  Play, 
  Smartphone, 
  ShieldCheck, 
  Info, 
  Check, 
  X, 
  Battery, 
  Signal, 
  TrendingUp, 
  Sliders,
  Repeat,
  Compass
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  meshNetwork, 
  TopologyNode, 
  TopologyLink, 
  MeshDiagnosticSummary 
} from '../services/meshNetwork';

interface MeshTopologyViewerProps {
  onOpenPairModal?: () => void;
}

export function MeshTopologyViewer({ onOpenPairModal }: MeshTopologyViewerProps) {
  const [nodes, setNodes] = useState<TopologyNode[]>([]);
  const [links, setLinks] = useState<TopologyLink[]>([]);
  const [summary, setSummary] = useState<MeshDiagnosticSummary>({
    totalNodes: 1,
    activeRelays: 0,
    directHops: 0,
    multiHops: 0,
    averageLatencyMs: 0,
    healthStatus: 'isolated',
    offlineReadinessPercent: 20,
    activeTransports: []
  });

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRelayEnabled, setIsRelayEnabled] = useState(meshNetwork.isRelayModeEnabled());
  const [diagnosing, setDiagnosing] = useState(false);
  const [traceLog, setTraceLog] = useState<{
    targetName: string;
    rttMs: number;
    hops: string[];
    details: string;
    status: 'ok' | 'timeout' | 'warning';
  } | null>(null);

  const refreshTopology = () => {
    setNodes(meshNetwork.getTopologyNodes());
    setLinks(meshNetwork.getTopologyLinks());
    setSummary(meshNetwork.getDiagnosticSummary());
    setIsRelayEnabled(meshNetwork.isRelayModeEnabled());
  };

  useEffect(() => {
    refreshTopology();
    const unsub = meshNetwork.subscribeTopology(() => {
      refreshTopology();
    });
    return () => unsub();
  }, []);

  // Seleciona o nó local por padrão caso nenhum esteja selecionado
  useEffect(() => {
    if (!selectedNodeId && nodes.length > 0) {
      const localNode = nodes.find(n => n.isLocal);
      if (localNode) setSelectedNodeId(localNode.id);
    }
  }, [nodes, selectedNodeId]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || nodes.find(n => n.isLocal) || null;

  const handleToggleLocalRelay = () => {
    const next = !isRelayEnabled;
    setIsRelayEnabled(next);
    meshNetwork.setRelayModeEnabled(next);
    refreshTopology();
  };

  const handleTogglePeerRelay = (peerId: string) => {
    meshNetwork.togglePeerRelayRole(peerId);
    refreshTopology();
  };

  const handleRunPingTrace = async (targetId?: string) => {
    setDiagnosing(true);
    setTraceLog(null);
    try {
      const res = await meshNetwork.runDiagnosticTrace(targetId);
      const target = nodes.find(n => n.id === targetId);
      setTraceLog({
        targetName: target ? target.name : 'Malha Local',
        rttMs: res.rttMs,
        hops: res.hopsTraversed,
        details: res.details,
        status: res.status
      });
      refreshTopology();
    } catch (err: any) {
      console.error('Erro no diagnóstico trace:', err);
    } finally {
      setDiagnosing(false);
    }
  };

  // Helper para posições dos nós no gráfico SVG (Diagrama Radial em Anéis de Saltos)
  const getCoordinates = (index: number, total: number, hopCount: number) => {
    const centerX = 260;
    const centerY = 210;

    if (hopCount === 0) {
      return { x: centerX, y: centerY };
    }

    // Salto 1 (Órbita Interna ~115px)
    if (hopCount === 1) {
      const angle = (2 * Math.PI * index) / Math.max(1, total) - Math.PI / 2;
      return {
        x: centerX + 115 * Math.cos(angle),
        y: centerY + 115 * Math.sin(angle)
      };
    }

    // Salto 2+ (Órbita Externa ~180px)
    const angle = (2 * Math.PI * index) / Math.max(1, total) - Math.PI / 4;
    return {
      x: centerX + 180 * Math.cos(angle),
      y: centerY + 180 * Math.sin(angle)
    };
  };

  const hop1Nodes = nodes.filter(n => n.hopCount === 1);
  const hop2Nodes = nodes.filter(n => n.hopCount > 1);

  const getTransportIcon = (transport: string) => {
    switch (transport) {
      case 'bluetooth':
        return <Bluetooth className="h-4 w-4 text-indigo-500" />;
      case 'webrtc-p2p':
        return <Zap className="h-4 w-4 text-emerald-500" />;
      case 'wifi-direct':
        return <Wifi className="h-4 w-4 text-blue-500" />;
      case 'ultrasound':
        return <Waves className="h-4 w-4 text-purple-500" />;
      default:
        return <Globe className="h-4 w-4 text-cyan-500" />;
    }
  };

  const getTransportBadgeColor = (transport: string) => {
    switch (transport) {
      case 'bluetooth':
        return 'bg-indigo-500/10 text-indigo-600 border-indigo-200';
      case 'webrtc-p2p':
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-200';
      case 'wifi-direct':
        return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'ultrasound':
        return 'bg-purple-500/10 text-purple-700 border-purple-200';
      default:
        return 'bg-cyan-500/10 text-cyan-700 border-cyan-200';
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header & Diagnostic Health Summary */}
      <div className="rounded-2xl bg-white p-5 border border-zinc-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-900">
                Topologia da Rede Mesh & Diagnóstico de Saltos
              </h2>
              <span className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                summary.healthStatus === 'excellent' ? "bg-emerald-100 text-emerald-800" :
                summary.healthStatus === 'good' ? "bg-blue-100 text-blue-800" :
                summary.healthStatus === 'degraded' ? "bg-amber-100 text-amber-800" :
                "bg-zinc-100 text-zinc-700"
              )}>
                {summary.healthStatus === 'excellent' ? 'Malha Excelente' :
                 summary.healthStatus === 'good' ? 'Operacional' :
                 summary.healthStatus === 'degraded' ? 'Sinal Degradado' : 'Modo Isolado (Local)'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Mapa visual de conexões diretas (1 salto) e repetidores intermediários (relays) para tráfego 100% offline.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRunPingTrace(selectedNode?.id)}
              disabled={diagnosing}
              className="flex items-center gap-1.5 rounded-xl bg-zinc-900 text-white px-3.5 py-2 text-xs font-semibold hover:bg-zinc-800 transition disabled:opacity-50 shadow-xs cursor-pointer"
            >
              <Activity className={cn("h-3.5 w-3.5 text-[#00a884]", diagnosing && "animate-spin")} />
              <span>{diagnosing ? 'Testando...' : 'Diagnosticar Rota'}</span>
            </button>

            {onOpenPairModal && (
              <button
                onClick={onOpenPairModal}
                className="flex items-center gap-1.5 rounded-xl bg-[#00a884] text-white px-3 py-2 text-xs font-bold hover:bg-[#009272] transition shadow-xs cursor-pointer"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>+ Conectar Nó</span>
              </button>
            )}
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <span className="text-[10px] text-zinc-500 block uppercase font-medium">Prontidão Offline</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg font-bold text-zinc-900">{summary.offlineReadinessPercent}%</span>
              <span className="text-[10px] text-emerald-600 font-semibold">Mesh Ativo</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <span className="text-[10px] text-zinc-500 block uppercase font-medium">Nós Conectados</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg font-bold text-zinc-900">{summary.totalNodes}</span>
              <span className="text-[10px] text-zinc-500">({summary.directHops} saltos diretos)</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <span className="text-[10px] text-zinc-500 block uppercase font-medium">Nós Relay (Repetidores)</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg font-bold text-indigo-600">{summary.activeRelays}</span>
              <span className="text-[10px] text-zinc-500">ampliando alcance</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <span className="text-[10px] text-zinc-500 block uppercase font-medium">Latência Média (RTT)</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg font-bold text-zinc-900">
                {summary.averageLatencyMs > 0 ? `${summary.averageLatencyMs} ms` : '< 1 ms'}
              </span>
              <span className="text-[10px] text-emerald-600">Tempo real</span>
            </div>
          </div>
        </div>

        {/* Local Relay Toggle Banner */}
        <div className="mt-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
              <Repeat className="h-3.5 w-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-950 block">
                Modo Relay Mesh deste Aparelho: {isRelayEnabled ? 'Ativado (Repetidor Ativo)' : 'Desativado'}
              </span>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Permite que outros aparelhos na malha usem este celular como ponte de salto (Store & Forward) para alcançar destinatários mais distantes.
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleLocalRelay}
            className={cn(
              "self-end sm:self-center px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer",
              isRelayEnabled 
                ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                : "bg-zinc-200 text-zinc-800 hover:bg-zinc-300"
            )}
          >
            {isRelayEnabled ? 'Relay Ativado' : 'Ativar Modo Relay'}
          </button>
        </div>
      </div>

      {/* 2. Visual Interactive Topology Graph & Node Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* SVG Topography Canvas (8 cols on lg) */}
        <div className="lg:col-span-7 xl:col-span-8 rounded-2xl bg-[#111b21] p-4 border border-zinc-800 text-white flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#00a884]" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Mapa Gráfico da Malha
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-zinc-400">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#00a884]" />
                <span>Salto 0 (Você)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-indigo-400" />
                <span>Salto 1 (Direto)</span>
              </div>
              {hop2Nodes.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-purple-400" />
                  <span>Salto 2+ (Relay)</span>
                </div>
              )}
            </div>
          </div>

          {/* Canvas SVG Area */}
          <div className="relative w-full aspect-4/3 min-h-[360px] max-h-[460px] flex items-center justify-center overflow-hidden bg-[#0c1317] rounded-xl border border-zinc-800/80">
            <svg 
              viewBox="0 0 520 420" 
              className="w-full h-full select-none"
            >
              <defs>
                {/* Radial circles background markers */}
                <radialGradient id="hubGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#00a884" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#00a884" stopOpacity="0.0" />
                </radialGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Hop 1 orbit ring */}
              <circle 
                cx="260" 
                cy="210" 
                r="115" 
                fill="none" 
                stroke="#202c33" 
                strokeWidth="1.5" 
                strokeDasharray="4 4" 
              />
              <text x="260" y="86" textAnchor="middle" fill="#8696a0" fontSize="9" letterSpacing="1">
                ANEL SALTO 1 (DIRETO)
              </text>

              {/* Hop 2 orbit ring (only if exists) */}
              {hop2Nodes.length > 0 && (
                <>
                  <circle 
                    cx="260" 
                    cy="210" 
                    r="180" 
                    fill="none" 
                    stroke="#182229" 
                    strokeWidth="1.5" 
                    strokeDasharray="6 6" 
                  />
                  <text x="260" y="24" textAnchor="middle" fill="#8696a0" fontSize="9" letterSpacing="1">
                    ANEL SALTO 2+ (EXTENSÃO RELAY)
                  </text>
                </>
              )}

              {/* Central aura for root node */}
              <circle cx="260" cy="210" r="45" fill="url(#hubGradient)" />

              {/* Draw Links between nodes */}
              {links.map((link) => {
                const sourceNode = nodes.find(n => n.id === link.sourceId);
                const targetNode = nodes.find(n => n.id === link.targetId);
                if (!sourceNode || !targetNode) return null;

                const srcIdx = sourceNode.hopCount === 0 ? 0 : hop1Nodes.findIndex(n => n.id === sourceNode.id);
                const tgtIdx = targetNode.hopCount === 1 
                  ? hop1Nodes.findIndex(n => n.id === targetNode.id)
                  : hop2Nodes.findIndex(n => n.id === targetNode.id);

                const srcPos = getCoordinates(srcIdx, sourceNode.hopCount === 1 ? hop1Nodes.length : 1, sourceNode.hopCount);
                const tgtPos = getCoordinates(tgtIdx, targetNode.hopCount === 1 ? hop1Nodes.length : hop2Nodes.length, targetNode.hopCount);

                const isSelectedLink = selectedNode && (selectedNode.id === sourceNode.id || selectedNode.id === targetNode.id);

                const strokeColor = link.transport === 'webrtc-p2p' ? '#10b981' :
                                    link.transport === 'bluetooth' ? '#818cf8' :
                                    link.transport === 'ultrasound' ? '#c084fc' : '#22d3ee';

                return (
                  <g key={link.id}>
                    <line
                      x1={srcPos.x}
                      y1={srcPos.y}
                      x2={tgtPos.x}
                      y2={tgtPos.y}
                      stroke={strokeColor}
                      strokeWidth={isSelectedLink ? "3" : "1.8"}
                      strokeDasharray={link.active ? "none" : "4 4"}
                      strokeOpacity={link.active ? (isSelectedLink ? "1" : "0.75") : "0.3"}
                    />

                    {/* Animated moving particle if active link */}
                    {link.active && (
                      <circle r="2.5" fill="#ffffff">
                        <animateMotion
                          path={`M ${srcPos.x} ${srcPos.y} L ${tgtPos.x} ${tgtPos.y}`}
                          dur="2.5s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}

                    {/* Link Latency Badge in middle of segment */}
                    <g transform={`translate(${(srcPos.x + tgtPos.x) / 2}, ${(srcPos.y + tgtPos.y) / 2})`}>
                      <rect 
                        x="-18" 
                        y="-8" 
                        width="36" 
                        height="16" 
                        rx="4" 
                        fill="#111b21" 
                        stroke="#2a3942" 
                        strokeWidth="1" 
                      />
                      <text 
                        x="0" 
                        y="3.5" 
                        textAnchor="middle" 
                        fill="#00a884" 
                        fontSize="8.5" 
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {link.latencyMs}ms
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Draw Nodes */}
              {nodes.map((node) => {
                const isRoot = node.isLocal;
                const isHop1 = node.hopCount === 1;
                const isSelected = selectedNode?.id === node.id;

                let index = 0;
                let totalInRing = 1;
                if (isHop1) {
                  index = hop1Nodes.findIndex(n => n.id === node.id);
                  totalInRing = hop1Nodes.length;
                } else if (node.hopCount > 1) {
                  index = hop2Nodes.findIndex(n => n.id === node.id);
                  totalInRing = hop2Nodes.length;
                }

                const pos = getCoordinates(index, totalInRing, node.hopCount);

                const nodeFill = isRoot ? "#00a884" : 
                                 node.role === 'relay' ? "#6366f1" : 
                                 node.status === 'connected' ? "#202c33" : "#182229";

                const nodeStroke = isSelected ? "#ffffff" : 
                                   isRoot ? "#25d366" : 
                                   node.role === 'relay' ? "#818cf8" : "#2a3942";

                return (
                  <g 
                    key={node.id} 
                    className="cursor-pointer transition-transform hover:scale-105"
                    onClick={() => setSelectedNodeId(node.id)}
                  >
                    {/* Selection outer ring */}
                    {isSelected && (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isRoot ? "30" : "26"}
                        fill="none"
                        stroke="#00a884"
                        strokeWidth="2"
                        strokeDasharray="3 3"
                        className="animate-spin"
                        style={{ transformOrigin: `${pos.x}px ${pos.y}px`, animationDuration: '8s' }}
                      />
                    )}

                    {/* Node circle */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isRoot ? "24" : "20"}
                      fill={nodeFill}
                      stroke={nodeStroke}
                      strokeWidth={isSelected ? "2.5" : "1.8"}
                      filter={isSelected ? "url(#glow)" : undefined}
                    />

                    {/* Role icon inside node */}
                    <text
                      x={pos.x}
                      y={pos.y + 4}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={isRoot ? "14" : "11"}
                      fontWeight="bold"
                    >
                      {isRoot ? "★" : node.role === 'relay' ? "🔁" : "📱"}
                    </text>

                    {/* Status dot */}
                    <circle
                      cx={pos.x + (isRoot ? 17 : 14)}
                      cy={pos.y - (isRoot ? 17 : 14)}
                      r="4"
                      fill={node.status === 'connected' ? "#22c55e" : "#ef4444"}
                      stroke="#111b21"
                      strokeWidth="1.5"
                    />

                    {/* Node Name Label */}
                    <text
                      x={pos.x}
                      y={pos.y + (isRoot ? 38 : 32)}
                      textAnchor="middle"
                      fill={isSelected ? "#ffffff" : "#d1d5db"}
                      fontSize="10"
                      fontWeight={isSelected ? "bold" : "normal"}
                    >
                      {node.name.length > 15 ? node.name.slice(0, 13) + '…' : node.name}
                    </text>

                    {/* Hop badge under label */}
                    <text
                      x={pos.x}
                      y={pos.y + (isRoot ? 48 : 42)}
                      textAnchor="middle"
                      fill="#8696a0"
                      fontSize="8.5"
                    >
                      {isRoot ? 'Salto 0 (Você)' : node.role === 'relay' ? 'Salto 1 (Relay)' : `Salto ${node.hopCount}`}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Quick Graph Footer Guide */}
          <div className="mt-2 text-[11px] text-[#8696a0] flex items-center justify-between">
            <span>Toque em qualquer nó do mapa para inspecionar métricas e rotas.</span>
            <span>Total: {nodes.length} nós mapeados</span>
          </div>
        </div>

        {/* Selected Node Inspector (4 cols on lg) */}
        <div className="lg:col-span-5 xl:col-span-4 rounded-2xl bg-white p-5 border border-zinc-200 shadow-xs flex flex-col justify-between space-y-4">
          {selectedNode ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-2xl shrink-0",
                    selectedNode.isLocal ? "bg-emerald-500/15 text-emerald-700" :
                    selectedNode.role === 'relay' ? "bg-indigo-500/15 text-indigo-700" :
                    "bg-zinc-100 text-zinc-700"
                  )}>
                    {selectedNode.isLocal ? (
                      <Radio className="h-6 w-6 text-[#00a884]" />
                    ) : (
                      getTransportIcon(selectedNode.transport)
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-zinc-900 truncate max-w-[170px]">
                        {selectedNode.name}
                      </h3>
                      {selectedNode.isLocal && (
                        <span className="rounded-md bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.2 font-bold">
                          VOCÊ
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-500 capitalize">
                      {selectedNode.role === 'relay' ? 'Nó Relay (Repetidor da Malha)' : 
                       selectedNode.isLocal ? 'Nó Origem / Gateway Local' : 'Nó Folha (Dispositivo P2P)'}
                    </span>
                  </div>
                </div>

                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0",
                  selectedNode.status === 'connected' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                )}>
                  {selectedNode.status === 'connected' ? 'Conectado' : 'Offline'}
                </span>
              </div>

              {/* Route Trajectory Breadcrumb */}
              <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100 space-y-1.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Caminho de Roteamento (Trajetória de Saltos)
                </span>
                <div className="flex items-center gap-1.5 flex-wrap text-xs font-semibold text-zinc-800">
                  <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    Você (Salto 0)
                  </span>
                  {selectedNode.hopCount > 1 && (
                    <>
                      <ArrowRight className="h-3 w-3 text-zinc-400 shrink-0" />
                      <span className="text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                        {selectedNode.viaRelayName || 'Nó Relay'} (Salto 1)
                      </span>
                    </>
                  )}
                  {!selectedNode.isLocal && (
                    <>
                      <ArrowRight className="h-3 w-3 text-zinc-400 shrink-0" />
                      <span className="text-zinc-900 bg-zinc-200 px-2 py-0.5 rounded-md">
                        {selectedNode.name} (Destino)
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Node Details Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-[10px] text-zinc-400 block font-medium">Contagem de Saltos</span>
                  <span className="font-bold text-zinc-900 mt-0.5 block">
                    {selectedNode.hopCount === 0 ? '0 (Nó Local)' : `${selectedNode.hopCount} Salto(s)`}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-[10px] text-zinc-400 block font-medium">Latência de Ida e Volta</span>
                  <span className="font-bold text-emerald-600 mt-0.5 block">
                    {selectedNode.rttMs} ms RTT
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-[10px] text-zinc-400 block font-medium">Protocolo de Transporte</span>
                  <span className="font-bold text-zinc-800 mt-0.5 block capitalize">
                    {selectedNode.transport}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-[10px] text-zinc-400 block font-medium">Força do Sinal (RSSI)</span>
                  <span className="font-bold text-zinc-800 mt-0.5 block">
                    {selectedNode.rssi ? `${selectedNode.rssi} dBm` : 'Cabo / Direto'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-[10px] text-zinc-400 block font-medium">Pacotes Retransmitidos</span>
                  <span className="font-bold text-zinc-800 mt-0.5 block">
                    {selectedNode.packetsForwarded} pacotes
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-[10px] text-zinc-400 block font-medium">Bateria do Nó</span>
                  <span className="font-bold text-zinc-800 mt-0.5 block">
                    {selectedNode.batteryLevel !== undefined ? `${selectedNode.batteryLevel}%` : 'Disponível'}
                  </span>
                </div>
              </div>

              {/* Actions for this node */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => handleRunPingTrace(selectedNode.id)}
                  disabled={diagnosing}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-900 text-white py-2.5 text-xs font-bold hover:bg-zinc-800 transition disabled:opacity-50 cursor-pointer"
                >
                  <Activity className={cn("h-4 w-4 text-[#00a884]", diagnosing && "animate-spin")} />
                  <span>{diagnosing ? 'Enviando sonda de teste...' : 'Fazer Ping / TraceRoute neste Nó'}</span>
                </button>

                {!selectedNode.isLocal && (
                  <button
                    onClick={() => handleTogglePeerRelay(selectedNode.id)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 py-2.5 text-xs font-bold hover:bg-indigo-100 transition cursor-pointer"
                  >
                    <Repeat className="h-4 w-4" />
                    <span>
                      {selectedNode.role === 'relay' 
                        ? 'Desativar Função Relay deste Nó' 
                        : 'Promover a Nó Relay Repetidor'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-400 text-xs">
              Selecione um nó no mapa para inspecionar.
            </div>
          )}

          {/* Trace Log Diagnostic Result */}
          {traceLog && (
            <div className="rounded-xl bg-zinc-900 p-3.5 text-white space-y-2 text-xs border border-zinc-800 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="font-bold text-[#00a884]">Resultado do TraceRoute:</span>
                <span className="font-mono text-[10px] text-zinc-400">{traceLog.rttMs}ms</span>
              </div>
              <div className="space-y-1 font-mono text-[11px] text-zinc-300">
                {traceLog.hops.map((hop, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[#00a884]">➔</span>
                    <span>{hop}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60">
                {traceLog.details}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Hop Routing Table (Tabela de Roteamento de Saltos) */}
      <div className="rounded-2xl bg-white p-5 border border-zinc-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">
              Tabela de Roteamento de Saltos (Hop Forwarding Table)
            </h3>
            <p className="text-xs text-zinc-500">
              Rotas ativas registradas pelo motor de roteamento store-and-forward da malha.
            </p>
          </div>

          <button
            onClick={refreshTopology}
            className="flex items-center gap-1.5 text-xs text-[#00a884] font-bold hover:underline cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Atualizar Tabela</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Dispositivo Destino</th>
                <th className="py-2.5 px-3">Papel na Malha</th>
                <th className="py-2.5 px-3">Saltos (Hops)</th>
                <th className="py-2.5 px-3">Próximo Salto (Next Hop)</th>
                <th className="py-2.5 px-3">Transporte</th>
                <th className="py-2.5 px-3">Latência Estimada</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-800">
              {nodes.map((node) => (
                <tr 
                  key={node.id} 
                  className={cn(
                    "hover:bg-zinc-50/80 transition cursor-pointer",
                    selectedNodeId === node.id && "bg-emerald-50/30"
                  )}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  <td className="py-3 px-3 font-semibold text-zinc-900 flex items-center gap-2">
                    {node.isLocal ? (
                      <Radio className="h-4 w-4 text-[#00a884] shrink-0" />
                    ) : (
                      getTransportIcon(node.transport)
                    )}
                    <span>{node.name}</span>
                    {node.isLocal && (
                      <span className="rounded-md bg-emerald-100 text-emerald-800 text-[9px] px-1 font-bold">
                        LOCAL
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3">
                    <span className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                      node.role === 'relay' ? "bg-indigo-100 text-indigo-800" :
                      node.isLocal ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-700"
                    )}>
                      {node.role === 'relay' ? 'Nó Relay' : node.isLocal ? 'Gateway' : 'Nó Folha'}
                    </span>
                  </td>

                  <td className="py-3 px-3 font-mono">
                    {node.hopCount === 0 ? '0' : `${node.hopCount} salto`}
                  </td>

                  <td className="py-3 px-3 text-zinc-600">
                    {node.hopCount === 0 ? 'Local' :
                     node.hopCount === 1 ? 'Direto (P2P)' : (node.viaRelayName || 'Nó Relay')}
                  </td>

                  <td className="py-3 px-3">
                    <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize", getTransportBadgeColor(node.transport))}>
                      {node.transport}
                    </span>
                  </td>

                  <td className="py-3 px-3 font-mono font-medium text-emerald-600">
                    {node.rttMs} ms
                  </td>

                  <td className="py-3 px-3">
                    <span className={cn(
                      "inline-flex items-center gap-1 font-medium text-[11px]",
                      node.status === 'connected' ? "text-emerald-600" : "text-rose-500"
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", node.status === 'connected' ? "bg-emerald-500" : "bg-rose-500")} />
                      {node.status === 'connected' ? 'Ativo' : 'Offline'}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                        handleRunPingTrace(node.id);
                      }}
                      className="rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer"
                    >
                      Ping
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Intelligent Offline Diagnostic Guidance Box */}
      <div className="rounded-2xl bg-white p-5 border border-zinc-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-[#00a884]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
            Diagnóstico Automático & Recomendações Offline
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 space-y-1">
            <span className="font-bold text-zinc-900 block">Conexões por Salto (Hops)</span>
            <p className="text-zinc-600 text-[11px] leading-relaxed">
              Dispositivos a 1 salto estão no alcance direto. Dispositivos a 2+ saltos recebem pacotes retransmitidos pelos nós intermediários marcados como Relay.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 space-y-1">
            <span className="font-bold text-zinc-900 block">Melhorar Sinal Bluetooth</span>
            <p className="text-zinc-600 text-[11px] leading-relaxed">
              Se a latência ultrapassar 100ms ou o RSSI for inferior a -80 dBm, aproxime os aparelhos para até 15 metros sem obstáculos de concreto.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 space-y-1">
            <span className="font-bold text-zinc-900 block">Velocidade Máxima (WebRTC P2P)</span>
            <p className="text-zinc-600 text-[11px] leading-relaxed">
              Para envio instantâneo de notas de voz e fotos grandes, utilize a conexão WebRTC P2P via QR Code na mesma rede Wi-Fi ou Ponto de Acesso.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
