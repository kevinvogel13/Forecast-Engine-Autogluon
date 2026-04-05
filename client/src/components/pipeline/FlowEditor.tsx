import React, { useCallback, useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ReactFlow, 
  MiniMap, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  Connection,
  Edge,
  MarkerType,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  NodeTypes
} from '@xyflow/react';
 
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Play, Settings2, Trash2, X, FolderOpen, Save, BarChart3, Database, FileText, Activity, MoreHorizontal, ChevronDown, GitMerge, FilePlus, GripVertical, ArrowUp, ArrowDown, Upload, Cpu, Undo2, Redo2, Download, AlertCircle, LayoutTemplate, LayoutGrid, Clock as ClockIcon, CheckCircle2, TriangleAlert, History, ShieldCheck, Search, Plus, Link2Off, Copy, Command, MousePointer2, Filter } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import FileDropzone from '@/components/file-upload/FileDropzone';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PipelineNode from './PipelineNode';
import NodePalette, { categories as nodeCategories } from './NodePalette';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Define custom node types
const nodeTypes: NodeTypes = {
  custom: PipelineNode,
};

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Editor from '@monaco-editor/react';
import { CHART_TYPES, renderChart, exportChartSVG } from '@/components/exploration/ExplorationCharts';
import ForecastResultsDashboard, { type ForecastResults } from '@/components/dashboard/ForecastResultsDashboard';
import { HEADER_PORTAL_ID } from '@/components/layout/Shell';
import { usePipelines, useCreatePipeline, useUpdatePipeline, useDeletePipeline, useExecutePipeline } from '@/hooks/usePipelines';
import { useDatasets } from '@/hooks/useDatasets';

const ALL_MODELS: Record<string, {label: string, category: string}> = {
  naive: { label: "Naive", category: "Statistical" },
  seasonal_naive: { label: "SeasonalNaive", category: "Statistical" },
  ets: { label: "ETS", category: "Statistical" },
  arima: { label: "ARIMA", category: "Statistical" },
  auto_arima: { label: "AutoARIMA", category: "Statistical" },
  theta: { label: "Theta", category: "Statistical" },
  croston: { label: "Croston", category: "Statistical" },
  deepar: { label: "DeepAR", category: "Deep Learning" },
  tft: { label: "TemporalFusionTransformer", category: "Deep Learning" },
  transformer: { label: "Transformer", category: "Deep Learning" },
  simple_feed_forward: { label: "SimpleFeedForward", category: "Deep Learning" },
  recursive_tabular: { label: "RecursiveTabular", category: "Tree-Based" },
  direct_tabular: { label: "DirectTabular", category: "Tree-Based" },
  chronos: { label: "Chronos", category: "Foundation" },
  chronos_bolt: { label: "ChronosBolt", category: "Foundation" },
  weighted_ensemble: { label: "WeightedEnsemble", category: "Ensemble" },
};

const PIPELINE_TEMPLATES = [
  {
    id: 'basic-forecast',
    name: 'Basic Forecast',
    description: 'Upload a CSV, configure your model, and generate a forecast.',
    nodes: [
      { id: 'tpl_1', type: 'custom', position: { x: 80, y: 200 }, data: { label: 'Data Source', type: 'input', status: 'pending', stats: { rows: 0, cols: 0 } } },
      { id: 'tpl_2', type: 'custom', position: { x: 320, y: 200 }, data: { label: 'Preview', type: 'preview', status: 'pending', stats: { rows: 0, cols: 0 } } },
      { id: 'tpl_3', type: 'custom', position: { x: 560, y: 200 }, data: { label: 'Model Config', type: 'config', status: 'pending', stats: { rows: 0, cols: 0 } } },
      { id: 'tpl_4', type: 'custom', position: { x: 800, y: 200 }, data: { label: 'Output', type: 'output', status: 'pending', stats: { rows: 0, cols: 0 } } },
    ],
    edges: [
      { id: 'te1', source: 'tpl_1', target: 'tpl_2', animated: true, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: '#64748b' } },
      { id: 'te2', source: 'tpl_2', target: 'tpl_3', animated: true, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: '#64748b' } },
      { id: 'te3', source: 'tpl_3', target: 'tpl_4', animated: true, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: '#64748b' } },
    ],
  },
  {
    id: 'eda-cleaning',
    name: 'EDA + Data Cleaning',
    description: 'Profile your data, fill missing values, remove outliers, then explore with charts.',
    nodes: [
      { id: 'tpl_1', type: 'custom', position: { x: 80, y: 200 }, data: { label: 'Data Source', type: 'input', status: 'pending', stats: { rows: 0, cols: 0 } } },
      { id: 'tpl_2', type: 'custom', position: { x: 300, y: 100 }, data: { label: 'Fill Missing', type: 'fillMissing', status: 'pending', stats: { rows: 0, cols: 0 } } },
      { id: 'tpl_3', type: 'custom', position: { x: 300, y: 300 }, data: { label: 'Remove Duplicates', type: 'removeDuplicates', status: 'pending', stats: { rows: 0, cols: 0 } } },
      { id: 'tpl_4', type: 'custom', position: { x: 520, y: 200 }, data: { label: 'Outlier Treatment', type: 'outlierTreatment', status: 'pending', stats: { rows: 0, cols: 0 } } },
      { id: 'tpl_5', type: 'custom', position: { x: 740, y: 100 }, data: { label: 'Validation', type: 'validation', status: 'pending', stats: { rows: 0, cols: 0 } } },
      { id: 'tpl_6', type: 'custom', position: { x: 740, y: 300 }, data: { label: 'Exploration', type: 'exploration', status: 'pending', stats: { rows: 0, cols: 0 } } },
    ],
    edges: [
      { id: 'te1', source: 'tpl_1', target: 'tpl_2', animated: true, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: '#64748b' } },
      { id: 'te2', source: 'tpl_1', target: 'tpl_3', animated: true, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: '#64748b' } },
      { id: 'te3', source: 'tpl_2', target: 'tpl_4', animated: true, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: '#64748b' } },
      { id: 'te4', source: 'tpl_3', target: 'tpl_4', animated: true, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: '#64748b' } },
      { id: 'te5', source: 'tpl_4', target: 'tpl_5', animated: true, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: '#64748b' } },
      { id: 'te6', source: 'tpl_4', target: 'tpl_6', animated: true, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: '#64748b' } },
    ],
  },
  {
    id: 'backtest-pipeline',
    name: 'Backtest Pipeline',
    description: 'Clean your data, train a model with walk-forward backtesting, and review results.',
    nodes: [
      { id: 'tpl_1', type: 'custom', position: { x: 60, y: 200 }, data: { label: 'Data Source', type: 'input', status: 'pending', stats: { rows: 0, cols: 0 } } },
      { id: 'tpl_2', type: 'custom', position: { x: 280, y: 120 }, data: { label: 'Fill Missing', type: 'fillMissing', status: 'pending', stats: { rows: 0, cols: 0 } } },
      { id: 'tpl_3', type: 'custom', position: { x: 280, y: 280 }, data: { label: 'Date Gap Fill', type: 'dateGapFill', status: 'pending', stats: { rows: 0, cols: 0 } } },
      { id: 'tpl_4', type: 'custom', position: { x: 500, y: 200 }, data: { label: 'Model Config', type: 'config', status: 'pending', stats: { rows: 0, cols: 0 } } },
      { id: 'tpl_5', type: 'custom', position: { x: 720, y: 120 }, data: { label: 'Output', type: 'output', status: 'pending', stats: { rows: 0, cols: 0 } } },
      { id: 'tpl_6', type: 'custom', position: { x: 720, y: 280 }, data: { label: 'Backtest Results', type: 'exploration', status: 'pending', stats: { rows: 0, cols: 0 } } },
    ],
    edges: [
      { id: 'te1', source: 'tpl_1', target: 'tpl_2', animated: true, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: '#64748b' } },
      { id: 'te2', source: 'tpl_1', target: 'tpl_3', animated: true, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: '#64748b' } },
      { id: 'te3', source: 'tpl_2', target: 'tpl_4', animated: true, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: '#64748b' } },
      { id: 'te4', source: 'tpl_3', target: 'tpl_4', animated: true, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: '#64748b' } },
      { id: 'te5', source: 'tpl_4', target: 'tpl_5', animated: true, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: '#64748b' } },
      { id: 'te6', source: 'tpl_4', target: 'tpl_6', animated: true, style: { stroke: '#64748b', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: '#64748b' } },
    ],
  },
];

const initialNodes: any[] = [];

const defaultEdgeStyle = { 
  stroke: '#64748b', 
  strokeWidth: 2,
};

const initialEdges: any[] = [];


const getId = () => `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function FlowWithProvider() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentPipelineId, setCurrentPipelineId] = useState<string | null>(null);
  const [pipelineName, setPipelineName] = useState('');
  const [pipelineDescription, setPipelineDescription] = useState('');
  
  const { data: savedPipelines = [], isLoading: pipelinesLoading } = usePipelines();
  const { data: datasets = [] } = useDatasets();
  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline();
  const deletePipeline = useDeletePipeline();

  // Undo / Redo history
  const historyRef = useRef<{ nodes: any[]; edges: any[] }[]>([]);
  const historyIndexRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Hidden file input for JSON import
  const importFileRef = useRef<HTMLInputElement>(null);

  // Load-dialog tab: 'saved' | 'templates'
  const [loadDialogTab, setLoadDialogTab] = useState<'saved' | 'templates'>('saved');

  // Refs to always have latest nodes/edges for history snapshots
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  
  // Edge click popover state
  const [selectedEdgeData, setSelectedEdgeData] = useState<{ id: string, x: number, y: number, sourceNode: any, targetNode: any } | null>(null);
  
  // Store output data shapes for each node (nodeId -> { rows, cols })
  const [nodeOutputShapes, setNodeOutputShapes] = useState<Record<string, { rows: number; cols: number }>>({});

  // Copy / Paste clipboard
  const clipboardNodeRef = useRef<any>(null);

  // Execution history log
  const [runHistory, setRunHistory] = useState<Array<{
    id: string;
    timestamp: Date;
    duration: number;
    success: boolean;
    nodeResults: Array<{ nodeId: string; label: string; status: string; rows: number }>;
    errorMessage?: string;
  }>>([]);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

  // Pre-run validation
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationIssues, setValidationIssues] = useState<Array<{ level: 'error' | 'warning'; message: string }>>([]);

  // Dataset column profile (fetched on demand)
  const [datasetProfile, setDatasetProfile] = useState<Array<{ name: string; type: string; nullCount: number; sample: string }> | null>(null);
  const [datasetProfileLoading, setDatasetProfileLoading] = useState(false);

  // Node hover preview data (nodeId -> { rows, columns })
  const [nodePreviewData, setNodePreviewData] = useState<Record<string, { rows: Array<Record<string,any>>; columns: string[] }>>({});
  
  // Modal states for full views
  const [resultsOpen, setResultsOpen] = useState(false);
  const [resultsModelInfo, setResultsModelInfo] = useState<ForecastResults | null>(null);

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  // Ctrl+K command palette
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');

  // Chart preview export ref
  const chartPreviewRef = useRef<HTMLDivElement>(null);

  // Advanced config state (Model Specs)
  const [cfgEvalMetric, setCfgEvalMetric] = useState("MASE");
  const [cfgQuantiles, setCfgQuantiles] = useState<string[]>(["0.1", "0.5", "0.9"]);
  const [cfgCIPreset, setCfgCIPreset] = useState<"80"|"90"|"95"|"99"|"custom">("80");
  const [cfgPreset, setCfgPreset] = useState("fast");
  const [cfgTimeLimit, setCfgTimeLimit] = useState("600");
  const [cfgRefitFull, setCfgRefitFull] = useState(true);

  const CI_PRESETS: Record<string, { label: string; desc: string; quantiles: string[] }> = {
    "80": { label: "80% CI", desc: "Wider intervals, higher coverage", quantiles: ["0.1", "0.5", "0.9"] },
    "90": { label: "90% CI", desc: "Balanced — good default", quantiles: ["0.05", "0.5", "0.95"] },
    "95": { label: "95% CI", desc: "Narrower bands, lower miss rate", quantiles: ["0.025", "0.5", "0.975"] },
    "99": { label: "99% CI", desc: "Very tight — use with caution", quantiles: ["0.005", "0.5", "0.995"] },
    "custom": { label: "Custom", desc: "Pick individual quantile levels", quantiles: [] },
  };

  const PRESET_CARDS = [
    { value: "fast", label: "⚡ Fast", time: "≤60s", quality: "Good for exploration" },
    { value: "medium_quality", label: "⚖ Medium", time: "≤5 min", quality: "Balanced quality" },
    { value: "high_quality", label: "🎯 High", time: "≤20 min", quality: "Strong accuracy" },
    { value: "best_quality", label: "🏆 Best", time: "Unlimited", quality: "Maximum accuracy" },
  ];

  // Advanced config state (Feature Engineering)
  const [cfgTargetVar, setCfgTargetVar] = useState("");
  const [cfgTimeCol, setCfgTimeCol] = useState("");
  const [cfgDfu, setCfgDfu] = useState("");
  const [cfgStaticFeatures, setCfgStaticFeatures] = useState<string[]>([]);
  const [cfgKnownCovariates, setCfgKnownCovariates] = useState<string[]>([]);
  const [cfgHolidayEnabled, setCfgHolidayEnabled] = useState(true);
  const [cfgHolidayCountry, setCfgHolidayCountry] = useState("US");

  // Advanced config state (Data Preprocessing - applied within train/test splits)
  const [cfgFillMissing, setCfgFillMissing] = useState(false);
  const [cfgFillConfigs, setCfgFillConfigs] = useState<Record<string, { strategy: string; constant: string }>>({});
  const [cfgOutlierTreatment, setCfgOutlierTreatment] = useState(false);
  const [cfgOutlierConfigs, setCfgOutlierConfigs] = useState<Record<string, { method: string; threshold: string; action: string }>>({});

  // Preset-to-models mapping
  const PRESET_MODELS: Record<string, string[]> = {
    fast: ["naive", "seasonal_naive", "ets", "arima", "auto_arima", "theta", "croston"],
    medium: ["naive", "seasonal_naive", "ets", "arima", "auto_arima", "theta", "croston", "recursive_tabular", "direct_tabular", "simple_feed_forward", "weighted_ensemble"],
    high: ["naive", "seasonal_naive", "ets", "arima", "auto_arima", "theta", "croston", "recursive_tabular", "direct_tabular", "simple_feed_forward", "weighted_ensemble", "deepar", "tft"],
    best: Object.keys(ALL_MODELS),
  };

  const getModelsForPreset = (preset: string) => {
    const models = PRESET_MODELS[preset] || PRESET_MODELS.fast;
    const result: Record<string, boolean> = {};
    Object.keys(ALL_MODELS).forEach(k => { result[k] = models.includes(k); });
    return result;
  };

  // Advanced config state (Models & Hyperparameters)
  const [cfgSelectedModels, setCfgSelectedModels] = useState<Record<string, boolean>>(getModelsForPreset("fast"));

  // Advanced config state (System)
  const [cfgGpus, setCfgGpus] = useState("auto");
  const [cfgCpus, setCfgCpus] = useState("auto");
  const [cfgLogLevel, setCfgLogLevel] = useState("info");
  
  // Clean up selected features when schema columns change
  useEffect(() => {
    const excluded = new Set([cfgTargetVar, cfgTimeCol, cfgDfu].filter(Boolean));
    setCfgStaticFeatures(prev => prev.filter(c => !excluded.has(c)));
    setCfgKnownCovariates(prev => prev.filter(c => !excluded.has(c)));
  }, [cfgTargetVar, cfgTimeCol, cfgDfu]);

  const isRestoringRef = useRef(false);

  useEffect(() => {
    if (selectedNode?.data?.type === 'config') {
      isRestoringRef.current = true;
      setCfgTargetVar(selectedNode.data.cfgTargetVar || '');
      setCfgTimeCol(selectedNode.data.cfgTimeCol || '');
      setCfgDfu(selectedNode.data.cfgDfu || '');
      setCfgStaticFeatures(selectedNode.data.cfgStaticFeatures || []);
      setCfgKnownCovariates(selectedNode.data.cfgKnownCovariates || []);
      setCfgHolidayEnabled(selectedNode.data.cfgHolidayEnabled ?? true);
      setCfgHolidayCountry(selectedNode.data.cfgHolidayCountry || 'US');
      setCfgFillMissing(selectedNode.data.cfgFillMissing ?? false);
      setCfgFillConfigs(selectedNode.data.cfgFillConfigs || {});
      setCfgOutlierTreatment(selectedNode.data.cfgOutlierTreatment ?? false);
      setCfgOutlierConfigs(selectedNode.data.cfgOutlierConfigs || {});
      setCfgEvalMetric(selectedNode.data.cfgEvalMetric || 'MASE');
      setCfgQuantiles(selectedNode.data.cfgQuantiles || ['0.1', '0.5', '0.9']);
      setCfgCIPreset(selectedNode.data.cfgCIPreset || '80');
      setCfgRefitFull(selectedNode.data.cfgRefitFull ?? true);
      setCfgSelectedModels(selectedNode.data.cfgSelectedModels || getModelsForPreset('fast'));
      setCfgPreset(selectedNode.data.cfgPreset || 'fast');
      setCfgTimeLimit(selectedNode.data.cfgTimeLimit || '600');
      setCfgGpus(selectedNode.data.cfgGpus || 'auto');
      setCfgCpus(selectedNode.data.cfgCpus || 'auto');
      setCfgLogLevel(selectedNode.data.cfgLogLevel || 'info');
      setTimeout(() => { isRestoringRef.current = false; }, 0);
    }
  }, [selectedNode?.id]);

  useEffect(() => {
    if (!selectedNode || selectedNode.data?.type !== 'config' || isRestoringRef.current) return;
    updateNodeData('cfgTargetVar', cfgTargetVar);
    updateNodeData('cfgTimeCol', cfgTimeCol);
    updateNodeData('cfgDfu', cfgDfu);
    updateNodeData('cfgStaticFeatures', cfgStaticFeatures);
    updateNodeData('cfgKnownCovariates', cfgKnownCovariates);
    updateNodeData('cfgHolidayEnabled', cfgHolidayEnabled);
    updateNodeData('cfgHolidayCountry', cfgHolidayCountry);
    updateNodeData('cfgFillMissing', cfgFillMissing);
    updateNodeData('cfgFillConfigs', cfgFillConfigs);
    updateNodeData('cfgOutlierTreatment', cfgOutlierTreatment);
    updateNodeData('cfgOutlierConfigs', cfgOutlierConfigs);
    updateNodeData('cfgEvalMetric', cfgEvalMetric);
    updateNodeData('cfgQuantiles', cfgQuantiles);
    updateNodeData('cfgCIPreset', cfgCIPreset);
    updateNodeData('cfgRefitFull', cfgRefitFull);
    updateNodeData('cfgSelectedModels', cfgSelectedModels);
    updateNodeData('cfgPreset', cfgPreset);
    updateNodeData('cfgTimeLimit', cfgTimeLimit);
    updateNodeData('cfgGpus', cfgGpus);
    updateNodeData('cfgCpus', cfgCpus);
    updateNodeData('cfgLogLevel', cfgLogLevel);
  }, [cfgTargetVar, cfgTimeCol, cfgDfu, cfgStaticFeatures, cfgKnownCovariates, cfgHolidayEnabled, cfgHolidayCountry, cfgFillMissing, cfgFillConfigs, cfgOutlierTreatment, cfgOutlierConfigs, cfgEvalMetric, cfgQuantiles, cfgCIPreset, cfgRefitFull, cfgSelectedModels, cfgPreset, cfgTimeLimit, cfgGpus, cfgCpus, cfgLogLevel]);

  // Component palette toggle
  const [paletteOpen, setPaletteOpen] = useState(false);
  
  // Quick-connect: when user clicks/drags from output handle and releases on empty space
  const connectingNodeId = useRef<string | null>(null);
  const quickConnectJustOpened = useRef(false);
  const [quickConnectMenu, setQuickConnectMenu] = useState<{ x: number; y: number; sourceNodeId: string } | null>(null);
  
  useEffect(() => {
    const handler = (e: Event) => {
      const { nodeId, x, y } = (e as CustomEvent).detail;
      if (nodeId) {
        quickConnectJustOpened.current = true;
        setQuickConnectMenu({ x, y, sourceNodeId: nodeId });
        setTimeout(() => { quickConnectJustOpened.current = false; }, 300);
      }
    };
    window.addEventListener('quick-connect-click', handler);
    return () => window.removeEventListener('quick-connect-click', handler);
  }, []);

  // Save as new flag and stashed values for restore on cancel
  const [saveAsNew, setSaveAsNew] = useState(false);
  const [stashedPipelineName, setStashedPipelineName] = useState('');
  const [stashedPipelineDescription, setStashedPipelineDescription] = useState('');
  
  // Header portal container
  const [headerPortal, setHeaderPortal] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = document.getElementById(HEADER_PORTAL_ID);
    if (el) setHeaderPortal(el);
  }, []);

  const [explorationPreview, setExplorationPreview] = useState<{ columns: string[], rows: any[], totalRows: number } | null>(null);
  const [explorationPreviewLoading, setExplorationPreviewLoading] = useState(false);

  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportPreviewData, setReportPreviewData] = useState<Array<{
    label: string;
    chartType: string;
    chartConfig: any;
    takeaway: string;
    data: { columns: string[], rows: any[], totalRows: number } | null;
  }>>([]);
  const [reportPreviewLoading, setReportPreviewLoading] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFilename, setExportFilename] = useState('');

  // ---- Undo / Redo ----
  const pushHistory = useCallback((snapshotNodes: any[], snapshotEdges: any[]) => {
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push({ nodes: JSON.parse(JSON.stringify(snapshotNodes)), edges: JSON.parse(JSON.stringify(snapshotEdges)) });
    if (newHistory.length > 50) newHistory.shift();
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const state = historyRef.current[historyIndexRef.current];
    setNodes(state.nodes);
    setEdges(state.edges);
    setSelectedNode(null);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const state = historyRef.current[historyIndexRef.current];
    setNodes(state.nodes);
    setEdges(state.edges);
    setSelectedNode(null);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, [setNodes, setEdges]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) return;
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrl = isMac ? e.metaKey : e.ctrlKey;
      if (!ctrl) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'c') {
        const sel = nodesRef.current.find(n => n.selected);
        if (sel) { clipboardNodeRef.current = JSON.parse(JSON.stringify(sel)); e.preventDefault(); toast.info('Node copied'); }
      }
      if (e.key === 'v') {
        if (!clipboardNodeRef.current) return;
        e.preventDefault();
        const src = clipboardNodeRef.current;
        const newNode = {
          ...src,
          id: getId(),
          position: { x: src.position.x + 40, y: src.position.y + 40 },
          selected: false,
          data: { ...src.data, status: 'pending', errorMessage: undefined },
        };
        pushHistory(nodesRef.current, edgesRef.current);
        setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat({ ...newNode, selected: true }));
        setSelectedNode(newNode);
        toast.success('Node pasted');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, pushHistory, setNodes]);

  useEffect(() => {
    const handleCmdK = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdPaletteOpen(prev => !prev);
        setCmdQuery('');
      }
      if (e.key === 'Escape') { setCmdPaletteOpen(false); setContextMenu(null); }
    };
    window.addEventListener('keydown', handleCmdK);
    return () => window.removeEventListener('keydown', handleCmdK);
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: any) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      pushHistory(nodesRef.current, edgesRef.current);
      setEdges((eds) => addEdge({
        ...params,
        animated: true,
        style: defaultEdgeStyle,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' }
      }, eds));
    },
    [setEdges, pushHistory],
  );

  const onConnectStart = useCallback((_: any, params: { nodeId: string | null; handleType: string | null }) => {
    if (params.handleType === 'source' && params.nodeId) {
      connectingNodeId.current = params.nodeId;
    }
  }, []);

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    if (!connectingNodeId.current) return;
    
    const target = event.target as HTMLElement;
    const targetEl = target.closest('.react-flow__handle[data-handlepos]');
    const isInputHandle = targetEl !== null && (targetEl as HTMLElement).dataset.handlepos === 'left';
    
    if (!isInputHandle) {
      const clientX = 'clientX' in event ? event.clientX : event.changedTouches?.[0]?.clientX ?? 0;
      const clientY = 'clientY' in event ? event.clientY : event.changedTouches?.[0]?.clientY ?? 0;
      
      quickConnectJustOpened.current = true;
      setQuickConnectMenu({
        x: clientX,
        y: clientY,
        sourceNodeId: connectingNodeId.current,
      });
      setTimeout(() => { quickConnectJustOpened.current = false; }, 200);
    }
    
    connectingNodeId.current = null;
  }, []);

  const onQuickConnectSelect = useCallback((nodeType: string, label: string) => {
    if (!quickConnectMenu) return;

    const position = screenToFlowPosition({
      x: quickConnectMenu.x,
      y: quickConnectMenu.y,
    });

    pushHistory(nodesRef.current, edgesRef.current);
    const newNode = {
      id: getId(),
      type: 'custom',
      position,
      data: {
        label,
        type: nodeType,
        stats: { rows: 0, cols: 0 },
        status: 'pending',
      },
    };

    setNodes((nds) => nds.concat(newNode));
    setEdges((eds) => addEdge({
      source: quickConnectMenu.sourceNodeId,
      target: newNode.id,
      animated: true,
      style: defaultEdgeStyle,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
    }, eds));
    setSelectedNode(newNode);
    setQuickConnectMenu(null);
  }, [quickConnectMenu, screenToFlowPosition, setNodes, setEdges, pushHistory]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow/type');
      const label = event.dataTransfer.getData('application/reactflow/label');
      
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      pushHistory(nodesRef.current, edgesRef.current);
      const newNode = {
        id: getId(),
        type: 'custom', 
        position,
        data: { 
           label: label, 
           type: type, 
           stats: { rows: 0, cols: 0 },
           status: 'pending'
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNode(newNode);
    },
    [screenToFlowPosition, setNodes, pushHistory],
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    const target = event.target as HTMLElement;
    if (target.closest('.react-flow__handle')) return;
    setSelectedNode(node);
    setSelectedEdgeData(null); // Close edge popover
  }, []);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    // Find source and target nodes to display relevant info
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    setSelectedEdgeData({
      id: edge.id,
      x: event.clientX,
      y: event.clientY,
      sourceNode,
      targetNode
    });
    
    // Don't select node
    event.stopPropagation();
  }, [nodes]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdgeData(null);
    setContextMenu(null);
  }, []);

  const updateNodeLabel = (label: string) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          node.data = { ...node.data, label };
        }
        return node;
      })
    );
    setSelectedNode((prev: any) => ({ ...prev, data: { ...prev.data, label } }));
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    pushHistory(nodesRef.current, edgesRef.current);
    setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id));
    setEdges((eds) => eds.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id));
    setSelectedNode(null);
  };

  const handleFileUpload = (fileName: string, dataset?: any) => {
    if (!selectedNode) return;
    
    const stats = dataset ? {
       rows: dataset.rows,
       cols: dataset.cols,
       volume: (dataset.size / (1024 * 1024)).toFixed(1) + 'M'
    } : {
       rows: 0,
       cols: 0,
       volume: '0M'
    };
    
    const columns = dataset?.columns || [];

    setNodes((nds) =>
       nds.map((node) => {
          if (node.id === selectedNode.id) {
             return {
                ...node,
                data: { 
                   ...node.data, 
                   label: fileName,
                   status: 'success',
                   stats,
                   columns,
                   datasetId: dataset?.id
                }
             };
          }
          return node;
       })
    );
    
    setSelectedNode((prev: any) => ({ 
       ...prev, 
       data: { 
          ...prev.data, 
          label: fileName,
          stats,
          columns,
          datasetId: dataset?.id
       } 
    }));
  };

  const loadPipeline = (pipeline: any) => {
    // Reset history when loading a new pipeline
    historyRef.current = [{ nodes: pipeline.nodes || [], edges: pipeline.edges || [] }];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
    setNodes(pipeline.nodes || []);
    setEdges(pipeline.edges || []);
    setCurrentPipelineId(pipeline.id);
    setPipelineName(pipeline.name);
    setPipelineDescription(pipeline.description || '');
    setLoadDialogOpen(false);
    toast.success(`Loaded pipeline: ${pipeline.name}`);
  };

  const handleSavePipeline = () => {
    if (!pipelineName.trim()) {
      toast.error('Please enter a pipeline name');
      return;
    }

    const pipelineData = {
      name: pipelineName,
      description: pipelineDescription,
      nodes,
      edges,
    };

    // If saveAsNew is true or no current pipeline, create a new one
    if (saveAsNew || !currentPipelineId) {
      createPipeline.mutate(pipelineData, {
        onSuccess: (newPipeline) => {
          setCurrentPipelineId(newPipeline.id);
          setSaveDialogOpen(false);
          setSaveAsNew(false);
          setStashedPipelineName('');
          setStashedPipelineDescription('');
        },
      });
    } else {
      updatePipeline.mutate({
        id: currentPipelineId,
        data: pipelineData,
      }, {
        onSuccess: () => {
          setSaveDialogOpen(false);
          setSaveAsNew(false);
          setStashedPipelineName('');
          setStashedPipelineDescription('');
        },
      });
    }
  };
  
  const handleCloseSaveDialog = (open: boolean) => {
    setSaveDialogOpen(open);
    if (!open) {
      // Restore stashed values if cancelling Save As New
      if (saveAsNew && stashedPipelineName) {
        setPipelineName(stashedPipelineName);
        setPipelineDescription(stashedPipelineDescription);
      }
      setSaveAsNew(false);
      setStashedPipelineName('');
      setStashedPipelineDescription('');
    }
  };

  const updateNodeData = (key: string, value: any) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          node.data = { ...node.data, [key]: value };
        }
        return node;
      })
    );
    setSelectedNode((prev: any) => ({ ...prev, data: { ...prev.data, [key]: value } }));
  };


  // ---- JSON Export / Import ----
  const exportPipelineJson = useCallback(() => {
    const data = {
      name: pipelineName || 'Untitled Pipeline',
      description: pipelineDescription,
      nodes,
      edges,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(pipelineName || 'pipeline').replace(/\s+/g, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pipelineName, pipelineDescription, nodes, edges]);

  const importPipelineJson = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
          toast.error('Invalid pipeline JSON: missing nodes or edges');
          return;
        }
        // Push before AND after states so undo is always available after import
        const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        newHistory.push({ nodes: JSON.parse(JSON.stringify(nodesRef.current)), edges: JSON.parse(JSON.stringify(edgesRef.current)) });
        newHistory.push({ nodes: JSON.parse(JSON.stringify(data.nodes)), edges: JSON.parse(JSON.stringify(data.edges)) });
        if (newHistory.length > 50) newHistory.splice(0, newHistory.length - 50);
        historyRef.current = newHistory;
        historyIndexRef.current = newHistory.length - 1;
        setCanUndo(true);
        setCanRedo(false);
        setNodes(data.nodes);
        setEdges(data.edges);
        setCurrentPipelineId(null);
        setPipelineName(data.name ? `${data.name} (imported)` : 'Imported Pipeline');
        setPipelineDescription(data.description || '');
        setSelectedNode(null);
        toast.success('Pipeline imported successfully');
      } catch {
        toast.error('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
  }, [setNodes, setEdges]);

  // Connect a source node to the currently selected node
  const connectFromNode = useCallback((sourceId: string) => {
    if (!selectedNode || sourceId === selectedNode.id) return;
    
    // Check if this connection already exists
    const existingEdge = edgesRef.current.find(e => e.source === sourceId && e.target === selectedNode.id);
    if (existingEdge) return;
    
    pushHistory(nodesRef.current, edgesRef.current);
    const newEdge = {
      id: `e${sourceId}-${selectedNode.id}`,
      source: sourceId,
      target: selectedNode.id,
      animated: true,
      style: defaultEdgeStyle,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' }
    };
    
    setEdges((eds) => [...eds, newEdge]);
  }, [selectedNode, setEdges, pushHistory]);

  // Get available source nodes (nodes that can connect to current node)
  const getAvailableSourceNodes = useCallback(() => {
    if (!selectedNode) return [];
    // All nodes except the current node and output nodes can be sources
    return nodes.filter(n => n.id !== selectedNode.id && n.data.type !== 'output');
  }, [nodes, selectedNode]);

  // Get current source connections for the selected node
  const getCurrentSources = useCallback(() => {
    if (!selectedNode) return [];
    const incomingEdges = edges.filter(e => e.target === selectedNode.id);
    return incomingEdges.map(e => {
      const sourceNode = nodes.find(n => n.id === e.source);
      return { edgeId: e.id, sourceId: e.source, sourceLabel: sourceNode?.data.label || e.source };
    });
  }, [selectedNode, edges, nodes]);

  // Disconnect a source from the current node
  const disconnectSource = useCallback((edgeId: string) => {
    pushHistory(nodesRef.current, edgesRef.current);
    setEdges((eds) => eds.filter(e => e.id !== edgeId));
  }, [setEdges, pushHistory]);
  
  // Recursively get columns from a node, tracing through the graph
  const getNodeColumns = useCallback((nodeId: string, visited: Set<string> = new Set()): string[] => {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return [];
    
    // If node has explicit columns, return them
    if (node.data.columns && node.data.columns.length > 0) {
      return node.data.columns;
    }
    
    // Otherwise, trace back through incoming edges
    const incomingEdges = edges.filter(e => e.target === nodeId);
    const allCols: string[] = [];
    
    incomingEdges.forEach(edge => {
      const sourceCols = getNodeColumns(edge.source, visited);
      sourceCols.forEach((col: string) => {
        if (!allCols.includes(col)) allCols.push(col);
      });
    });
    
    return allCols;
  }, [nodes, edges]);
  
  // Get columns from source nodes connected to a given node
  const getSourceColumns = useCallback((nodeId: string, sourceIndex?: number) => {
    const incomingEdges = edges.filter(e => e.target === nodeId);
    if (incomingEdges.length === 0) return [];
    
    // If sourceIndex provided, get specific source (for merge left/right)
    if (sourceIndex !== undefined && incomingEdges[sourceIndex]) {
      return getNodeColumns(incomingEdges[sourceIndex].source);
    }
    
    // Otherwise merge all source columns
    const allCols: string[] = [];
    incomingEdges.forEach(edge => {
      const sourceCols = getNodeColumns(edge.source);
      sourceCols.forEach((col: string) => {
        if (!allCols.includes(col)) allCols.push(col);
      });
    });
    return allCols;
  }, [edges, getNodeColumns]);

  // Get the source dataset ID by tracing edges back to input node
  const getSourceDatasetId = useCallback((nodeId: string, visited: Set<string> = new Set()): string | null => {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;
    
    // If this node has a datasetId, return it
    if (node.data.datasetId) {
      return node.data.datasetId;
    }
    
    // Otherwise, trace back through incoming edges
    const incomingEdges = edges.filter(e => e.target === nodeId);
    for (const edge of incomingEdges) {
      const datasetId = getSourceDatasetId(edge.source, visited);
      if (datasetId) return datasetId;
    }
    
    return null;
  }, [nodes, edges]);

  // Collect all filter configurations from upstream nodes
  const getUpstreamFilters = useCallback((nodeId: string, visited: Set<string> = new Set()): Array<{ column: string; operator: string; value: any }> => {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return [];
    
    const filters: Array<{ column: string; operator: string; value: any }> = [];
    
    // If this is a filter node with valid config, add it
    // Default filterOp to 'eq' to match UI default
    const filterOp = node.data.filterOp || 'eq';
    if (node.data.type === 'filter' && node.data.filterColumn) {
      // Determine the value based on operator type
      const multiSelectOps = ['isin', 'notin'];
      const needsValue = !['isnull', 'notnull'].includes(filterOp);
      
      let value;
      let hasValidValue = true;
      
      if (multiSelectOps.includes(filterOp)) {
        value = node.data.filterValues || [];
        hasValidValue = value.length > 0;
      } else if (needsValue) {
        value = node.data.filterValue;
        hasValidValue = value !== undefined && value !== null && value !== '';
      } else {
        value = null; // isnull/notnull don't need a value
      }
      
      if (hasValidValue) {
        filters.push({
          column: node.data.filterColumn,
          operator: filterOp,
          value: value
        });
      }
    }
    
    // Trace back through incoming edges to collect more filters
    const incomingEdges = edges.filter(e => e.target === nodeId);
    for (const edge of incomingEdges) {
      const upstreamFilters = getUpstreamFilters(edge.source, visited);
      filters.push(...upstreamFilters);
    }
    
    return filters;
  }, [nodes, edges]);

  // Collect ALL transforms from upstream nodes in topological order (from source to current node)
  // Returns an array of transform steps: { type: 'filter' | 'python' | 'sql' | 'sampling', data: any }
  const getUpstreamTransforms = useCallback((nodeId: string, visited: Set<string> = new Set()): Array<{ type: 'filter' | 'python' | 'sql' | 'sampling'; data: any }> => {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return [];
    
    // First, get transforms from upstream nodes
    const incomingEdges = edges.filter(e => e.target === nodeId);
    let transforms: Array<{ type: 'filter' | 'python' | 'sql' | 'sampling'; data: any }> = [];
    
    for (const edge of incomingEdges) {
      const upstreamTransforms = getUpstreamTransforms(edge.source, visited);
      transforms = [...transforms, ...upstreamTransforms];
    }
    
    // Then add this node's transform (if any)
    if (node.data.type === 'filter') {
      const multiSelectOps = ['isin', 'notin'];
      const noValueOps = ['isnull', 'notnull'];

      // Multi-condition filter builder (newer format) — send as one grouped transform
      const conditions: any[] = node.data.filterConditions || [];
      if (conditions.length > 0) {
        const normalised = conditions
          .filter((c: any) => c.column)
          .map((c: any) => {
            let value = c.value;
            if (multiSelectOps.includes(c.op)) value = c.values || [];
            else if (noValueOps.includes(c.op)) value = null;
            return { column: c.column, op: c.op, value, logic: c.logic || 'AND' };
          });
        if (normalised.length > 0) {
          transforms.push({ type: 'filter', data: { conditions: normalised } });
        }
      } else if (node.data.filterColumn) {
        // Legacy single-condition format
        const op = node.data.filterOp || 'eq';
        let value = node.data.filterValue;
        if (multiSelectOps.includes(op)) value = node.data.filterValues || [];
        else if (noValueOps.includes(op)) value = null;
        transforms.push({ type: 'filter', data: { column: node.data.filterColumn, operator: op, value } });
      }
    } else if (node.data.type === 'python' && node.data.code) {
      transforms.push({ type: 'python', data: node.data.code });
    } else if (node.data.type === 'sql' && node.data.query) {
      transforms.push({ type: 'sql', data: node.data.query });
    } else if (node.data.type === 'sampling' && node.data.samplingColumn) {
      transforms.push({ 
        type: 'sampling', 
        data: { 
          column: node.data.samplingColumn, 
          percent: node.data.samplePercent || 100,
          seed: node.data.samplingSeed ?? 42
        }
      });
    }
    
    return transforms;
  }, [nodes, edges]);

  // Legacy helpers for backward compatibility
  const getUpstreamPythonCode = useCallback((nodeId: string): string | null => {
    const transforms = getUpstreamTransforms(nodeId);
    const pythonTransforms = transforms.filter(t => t.type === 'python');
    return pythonTransforms.length > 0 ? pythonTransforms.map(t => t.data).join('\n\n') : null;
  }, [getUpstreamTransforms]);

  const getUpstreamSqlQuery = useCallback((nodeId: string): string | null => {
    const transforms = getUpstreamTransforms(nodeId);
    const sqlTransforms = transforms.filter(t => t.type === 'sql');
    return sqlTransforms.length > 0 ? sqlTransforms[sqlTransforms.length - 1].data : null;
  }, [getUpstreamTransforms]);

  // State for column values (for filter dropdowns)
  const [columnValues, setColumnValues] = useState<{
    column: string;
    values: string[];
    isCategorical: boolean;
    isNumeric: boolean;
  } | null>(null);
  const [columnValuesLoading, setColumnValuesLoading] = useState(false);

  const [dateColumnRanges, setDateColumnRanges] = useState<Record<string, { minDate: string; maxDate: string }>>({});
  const [configDateRange, setConfigDateRange] = useState<{
    minDate: string;
    maxDate: string;
  } | null>(null);

  // State for preview data
  const [previewData, setPreviewData] = useState<{
    columns: string[];
    rows: any[];
    totalRows: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Fetch column values when filter column changes
  const fetchColumnValues = useCallback(async (column: string) => {
    if (!selectedNode) return;
    
    const datasetId = getSourceDatasetId(selectedNode.id);
    if (!datasetId || !column) {
      setColumnValues(null);
      return;
    }
    
    setColumnValuesLoading(true);
    try {
      const response = await fetch(`/api/datasets/${datasetId}/column/${encodeURIComponent(column)}/values`);
      if (response.ok) {
        const data = await response.json();
        setColumnValues({
          column: data.column,
          values: data.uniqueValues,
          isCategorical: data.isCategorical,
          isNumeric: data.isNumeric
        });
      } else {
        setColumnValues(null);
      }
    } catch (error) {
      console.error('Failed to fetch column values:', error);
      setColumnValues(null);
    } finally {
      setColumnValuesLoading(false);
    }
  }, [selectedNode, getSourceDatasetId]);

  // Effect to fetch column values when filter column changes
  useEffect(() => {
    if (selectedNode?.data.type === 'filter' && selectedNode.data.filterColumn) {
      fetchColumnValues(selectedNode.data.filterColumn);
    } else {
      setColumnValues(null);
    }
  }, [selectedNode?.data.filterColumn, selectedNode?.data.type, fetchColumnValues]);

  useEffect(() => {
    if (!selectedNode || selectedNode.data.type !== 'config') {
      setConfigDateRange(null);
      setDateColumnRanges({});
      return;
    }

    const datasetId = getSourceDatasetId(selectedNode.id);
    if (!datasetId) { setConfigDateRange(null); setDateColumnRanges({}); return; }

    const columns = getNodeColumns(selectedNode.id);
    const dateHints = ['date', 'time', 'period', 'month', 'year', 'day', 'week'];
    const dateCols = columns.filter(c => dateHints.some(h => c.toLowerCase().includes(h)));

    (async () => {
      const ranges: Record<string, { minDate: string; maxDate: string }> = {};
      await Promise.all(dateCols.map(async (col) => {
        try {
          const resp = await fetch(`/api/datasets/${datasetId}/column/${encodeURIComponent(col)}/date-range`);
          if (resp.ok) {
            const data = await resp.json();
            if (data.minDate && data.maxDate) {
              ranges[col] = { minDate: data.minDate, maxDate: data.maxDate };
            }
          }
        } catch {}
      }));
      setDateColumnRanges(ranges);

      const dateCol = selectedNode.data.configDateColumn ||
        Object.keys(ranges)[0] || null;

      if (!selectedNode.data.configDateColumn && dateCol) {
        updateNodeData('configDateColumn', dateCol);
      }

      if (dateCol && ranges[dateCol]) {
        setConfigDateRange(ranges[dateCol]);
        if (!selectedNode.data.trainStart) updateNodeData('trainStart', ranges[dateCol].minDate);
        if (!selectedNode.data.trainEnd) updateNodeData('trainEnd', ranges[dateCol].maxDate);
      } else {
        setConfigDateRange(null);
      }
    })();
  }, [selectedNode?.id, selectedNode?.data.type, selectedNode?.data.configDateColumn, selectedNode?.data.modelMode, getSourceDatasetId, getNodeColumns]);

  // Effect to update filter node metadata when filter config changes
  useEffect(() => {
    if (!selectedNode || selectedNode.data.type !== 'filter') return;
    
    const datasetId = getSourceDatasetId(selectedNode.id);
    if (!datasetId) return;
    
    const { filterColumn, filterValue, filterValues } = selectedNode.data;
    // Default to 'eq' if filterOp is not set (matches UI default)
    const filterOp = selectedNode.data.filterOp || 'eq';
    
    // Only fetch if we have a filter column
    if (!filterColumn) return;
    
    // For operators that need a value, check if value is provided
    const needsValue = !['isnull', 'notnull'].includes(filterOp);
    const multiSelectOps = ['isin', 'notin'];
    
    // Determine the actual value to use
    let actualValue = filterValue;
    if (multiSelectOps.includes(filterOp)) {
      actualValue = filterValues || [];
      if (actualValue.length === 0) return; // Need at least one value for isin/notin
    } else if (needsValue && (filterValue === undefined || filterValue === null || filterValue === '')) {
      return;
    }
    
    // Fetch filtered count
    const filters = [{ column: filterColumn, operator: filterOp, value: actualValue }];
    
    fetch(`/api/datasets/${datasetId}/filtered-preview?limit=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters })
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && selectedNode) {
          // Update the node's stats metadata
          setNodes(nds => nds.map(n => {
            if (n.id === selectedNode.id) {
              return {
                ...n,
                data: {
                  ...n.data,
                  stats: {
                    rows: data.totalRows,
                    cols: data.columns?.length || 0
                  },
                  columns: data.columns || []
                }
              };
            }
            return n;
          }));
        }
      })
      .catch(err => console.error('Failed to fetch filter count:', err));
  }, [
    selectedNode?.id,
    selectedNode?.data.type,
    selectedNode?.data.filterColumn,
    selectedNode?.data.filterOp,
    selectedNode?.data.filterValue,
    selectedNode?.data.filterValues,
    getSourceDatasetId,
    setNodes
  ]);

  const fetchExplorationPreview = useCallback(async () => {
    if (!selectedNode) return;
    const datasetId = getSourceDatasetId(selectedNode.id);
    if (!datasetId) {
      toast.error('No data source connected');
      return;
    }
    setExplorationPreviewLoading(true);
    try {
      const transforms = getUpstreamTransforms(selectedNode.id);
      const chartType = selectedNode.data.chartType;
      const needsAllRows = ['adicv', 'pareto', 'boxplot', 'histogram', 'scatter', 'seasonal', 'outlier'].includes(chartType);
      const rowLimit = needsAllRows ? 200000 : 500;
      const response = await fetch(`/api/datasets/${datasetId}/transform?limit=${rowLimit}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transforms })
      });
      if (!response.ok) throw new Error('Failed to fetch preview');
      const data = await response.json();
      setExplorationPreview(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load preview');
    } finally {
      setExplorationPreviewLoading(false);
    }
  }, [selectedNode, getSourceDatasetId, getUpstreamTransforms]);

  useEffect(() => {
    setExplorationPreview(null);
  }, [selectedNode?.id]);

  const generateReportHTML = useCallback((title: string, sections: typeof reportPreviewData) => {
    const rechartsTypes = ['timeseries', 'histogram', 'boxplot', 'bar', 'scatter', 'pareto', 'seasonal', 'outliers', 'adicv'];
    const chartTypeLabels: Record<string, string> = {};
    CHART_TYPES.forEach(ct => { chartTypeLabels[ct.value] = ct.label; });

    const renderSection = (section: typeof reportPreviewData[0], idx: number) => {
      const chartLabel = chartTypeLabels[section.chartType] || 'Not configured';
      let contentHTML = '';

      if (section.chartType === 'richtext') {
        contentHTML = `<div class="richtext-content">${section.chartConfig.richTextContent || '<p>No content</p>'}</div>`;
      } else if (section.chartType === 'table' && section.data) {
        const cols = section.data.columns;
        const rows = section.data.rows.slice(0, 100);
        contentHTML = `<div class="table-wrapper"><table><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${cols.map(c => `<td>${row[c] != null ? String(row[c]) : ''}</td>`).join('')}</tr>`).join('')}</tbody></table>${section.data.rows.length > 100 ? `<p class="table-note">Showing 100 of ${section.data.rows.length} rows</p>` : ''}</div>`;
      } else if (section.chartType === 'summary' && section.data) {
        const cols = section.data.columns;
        const numericCols = cols.filter(c => {
          const vals = section.data!.rows.map(r => parseFloat(r[c])).filter(v => !isNaN(v));
          return vals.length > section.data!.rows.length * 0.5;
        });
        if (numericCols.length > 0) {
          const statsRows = numericCols.map(col => {
            const vals = section.data!.rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
            const sorted = [...vals].sort((a, b) => a - b);
            const n = vals.length;
            const mean = n > 0 ? vals.reduce((a, b) => a + b, 0) / n : 0;
            const min = sorted[0] ?? 0;
            const max = sorted[n - 1] ?? 0;
            const median = n > 0 ? sorted[Math.floor(n / 2)] : 0;
            const std = n > 1 ? Math.sqrt(vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1)) : 0;
            return `<tr><td class="font-medium">${col}</td><td>${n}</td><td>${mean.toFixed(2)}</td><td>${std.toFixed(2)}</td><td>${min.toFixed(2)}</td><td>${median.toFixed(2)}</td><td>${max.toFixed(2)}</td></tr>`;
          });
          contentHTML = `<div class="table-wrapper"><table><thead><tr><th>Column</th><th>Count</th><th>Mean</th><th>Std Dev</th><th>Min</th><th>Median</th><th>Max</th></tr></thead><tbody>${statsRows.join('')}</tbody></table></div>`;
        } else {
          contentHTML = '<p class="no-data">No numeric columns available for summary statistics</p>';
        }
      } else if (section.chartType === 'completeness' && section.data) {
        const cols = section.data.columns;
        const totalRows = section.data.rows.length;
        const qualityRows = cols.map(col => {
          const nonNull = section.data!.rows.filter(r => r[col] != null && r[col] !== '').length;
          const missing = totalRows - nonNull;
          const pct = totalRows > 0 ? ((nonNull / totalRows) * 100).toFixed(1) : '0.0';
          return `<tr><td class="font-medium">${col}</td><td>${totalRows}</td><td>${nonNull}</td><td>${missing}</td><td>${pct}%</td></tr>`;
        });
        contentHTML = `<div class="table-wrapper"><table><thead><tr><th>Column</th><th>Total</th><th>Non-null</th><th>Missing</th><th>Completeness</th></tr></thead><tbody>${qualityRows.join('')}</tbody></table></div>`;
      } else if (rechartsTypes.includes(section.chartType)) {
        contentHTML = `<div class="chart-placeholder"><div class="chart-placeholder-icon">📊</div><p>Chart rendered in application — view in pipeline editor</p><p class="chart-type-label">${chartLabel}</p></div>`;
      } else {
        contentHTML = `<p class="no-data">No preview available for this exploration type</p>`;
      }

      const configDetails: string[] = [];
      const cfg = section.chartConfig || {};
      if (cfg.dateColumn) configDetails.push(`Date: ${cfg.dateColumn}`);
      if (cfg.valueColumn) configDetails.push(`Value: ${cfg.valueColumn}`);
      if (cfg.groupColumn) configDetails.push(`Group: ${cfg.groupColumn}`);
      if (cfg.xColumn) configDetails.push(`X: ${cfg.xColumn}`);
      if (cfg.yColumn) configDetails.push(`Y: ${cfg.yColumn}`);
      if (cfg.idColumn) configDetails.push(`ID: ${cfg.idColumn}`);
      if (cfg.demandColumn) configDetails.push(`Demand: ${cfg.demandColumn}`);

      return `<div class="section-card">
        <div class="section-header">
          <div class="section-number">${idx + 1}</div>
          <div>
            <h2 class="section-title">${section.label}</h2>
            <span class="section-badge">${chartLabel}</span>
            ${configDetails.length > 0 ? `<div class="config-details">${configDetails.join(' · ')}</div>` : ''}
          </div>
        </div>
        <div class="section-body">${contentHTML}</div>
        ${section.takeaway ? `<div class="takeaway"><strong>Key Takeaway:</strong> ${section.takeaway}</div>` : ''}
      </div>`;
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; background: #f8fafc; }
    .container { max-width: 900px; margin: 40px auto; padding: 0 24px; }
    .report-header { background: white; border-radius: 12px; padding: 40px; margin-bottom: 24px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .report-header h1 { font-size: 28px; color: #0f172a; margin-bottom: 8px; font-weight: 700; }
    .report-header .meta { color: #94a3b8; font-size: 13px; display: flex; align-items: center; gap: 8px; }
    .section-card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .section-header { display: flex; align-items: flex-start; gap: 14px; padding: 20px 24px; border-bottom: 1px solid #f1f5f9; }
    .section-number { width: 28px; height: 28px; border-radius: 8px; background: #7c3aed; color: white; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
    .section-title { font-size: 17px; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
    .section-badge { display: inline-block; background: #f5f3ff; color: #7c3aed; font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 4px; border: 1px solid #ede9fe; }
    .config-details { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .section-body { padding: 20px 24px; }
    .takeaway { padding: 16px 24px; background: #fefce8; border-top: 1px solid #fef08a; font-size: 13px; color: #713f12; }
    .takeaway strong { color: #92400e; }
    .chart-placeholder { text-align: center; padding: 40px 20px; background: #f8fafc; border-radius: 8px; border: 2px dashed #e2e8f0; }
    .chart-placeholder-icon { font-size: 32px; margin-bottom: 8px; }
    .chart-placeholder p { color: #64748b; font-size: 13px; margin: 4px 0; }
    .chart-type-label { font-weight: 600; color: #7c3aed !important; }
    .table-wrapper { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f8fafc; color: #475569; font-weight: 600; text-align: left; padding: 10px 12px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
    td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    td.font-medium { font-weight: 500; }
    tr:hover td { background: #f8fafc; }
    .table-note { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 12px; }
    .no-data { color: #94a3b8; font-size: 13px; text-align: center; padding: 24px; }
    .richtext-content { font-size: 14px; line-height: 1.7; }
    .richtext-content h1, .richtext-content h2, .richtext-content h3 { color: #1e293b; margin: 16px 0 8px; }
    .richtext-content p { margin-bottom: 8px; }
    .richtext-content ul, .richtext-content ol { margin: 8px 0 8px 20px; }
    .footer { text-align: center; color: #94a3b8; font-size: 12px; padding: 32px 0 40px; border-top: 1px solid #e2e8f0; margin-top: 16px; }
    @media (max-width: 640px) { .container { padding: 0 12px; margin: 16px auto; } .report-header { padding: 24px; } .section-header { padding: 16px; } .section-body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="report-header">
      <h1>${title}</h1>
      <div class="meta">
        <span>Generated on ${new Date().toLocaleString()}</span>
        <span>&bull;</span>
        <span>${sections.length} exploration(s)</span>
      </div>
    </div>
    ${sections.map((s, i) => renderSection(s, i)).join('\n')}
    <div class="footer">
      <p>Report generated by Forecast Pipeline Application</p>
    </div>
  </div>
</body>
</html>`;
  }, []);

  const loadReportData = useCallback(async (): Promise<typeof reportPreviewData> => {
    if (!selectedNode) return [];
    const incomingEdges = edges.filter(e => e.target === selectedNode.id);
    const connectedExplorations = incomingEdges
      .map(e => nodes.find(n => n.id === e.source))
      .filter(n => n && n.data.type === 'exploration');

    if (connectedExplorations.length === 0) {
      toast.error('No exploration nodes connected to this report');
      return [];
    }

    const savedOrder: string[] = selectedNode.data.explorationOrder || [];
    const explorationNodes = [
      ...savedOrder.map(id => connectedExplorations.find(n => n?.id === id)).filter(Boolean),
      ...connectedExplorations.filter(n => n && !savedOrder.includes(n.id))
    ];

    const sections: typeof reportPreviewData = [];

    for (const expNode of explorationNodes) {
      if (!expNode) continue;
      let previewData = null;
      try {
        const datasetId = getSourceDatasetId(expNode.id);
        if (datasetId) {
          const transforms = getUpstreamTransforms(expNode.id);
          const expChartType = expNode.data.chartType || '';
          const expNeedsAllRows = ['adicv', 'pareto', 'boxplot', 'histogram', 'scatter', 'seasonal', 'outlier'].includes(expChartType);
          const expRowLimit = expNeedsAllRows ? 200000 : 500;
          const response = await fetch(`/api/datasets/${datasetId}/transform?limit=${expRowLimit}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transforms })
          });
          if (response.ok) {
            previewData = await response.json();
          }
        }
      } catch {}

      sections.push({
        label: expNode.data.label || 'Exploration',
        chartType: expNode.data.chartType || '',
        chartConfig: expNode.data.chartConfig || {},
        takeaway: expNode.data.takeaway || '',
        data: previewData
      });
    }

    return sections;
  }, [selectedNode, edges, nodes, getSourceDatasetId, getUpstreamTransforms]);

  const openExportDialog = useCallback(async () => {
    const reportTitle = selectedNode?.data.reportTitle || 'Untitled Report';
    setExportFilename(reportTitle);

    if (reportPreviewData.length === 0) {
      setReportPreviewLoading(true);
      const sections = await loadReportData();
      setReportPreviewData(sections);
      setReportPreviewLoading(false);
      if (sections.length === 0) {
        toast.error('No exploration nodes connected to this report');
        return;
      }
    }

    setExportDialogOpen(true);
  }, [selectedNode, reportPreviewData, loadReportData]);

  const doExportHTML = useCallback(() => {
    const filename = exportFilename.trim() || 'report';
    const safeFilename = filename.replace(/[^a-zA-Z0-9 _-]/g, '_');
    const html = generateReportHTML(filename, reportPreviewData);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFilename}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportDialogOpen(false);
    toast.success('Report exported successfully');
  }, [exportFilename, reportPreviewData, generateReportHTML]);

  const loadReportPreview = useCallback(async () => {
    if (!selectedNode) return;
    setReportPreviewLoading(true);
    const sections = await loadReportData();
    setReportPreviewData(sections);
    setReportPreviewLoading(false);
    if (sections.length > 0) {
      setReportPreviewOpen(true);
    }
  }, [selectedNode, loadReportData]);

  // Keep refs up-to-date for callbacks that capture them
  nodesRef.current = nodes;
  edgesRef.current = edges;

  // Compute a key that represents the current preview's upstream filter state
  const getPreviewKey = useCallback(() => {
    const previewNodeTypes = ['preview', 'python', 'sql'];
    if (!selectedNode || !previewNodeTypes.includes(selectedNode.data.type)) return '';
    // Walk the full upstream graph (all hops) and serialise transforms so that
    // any change — whether 1 or N hops away — invalidates the preview cache.
    const allTransforms = getUpstreamTransforms(selectedNode.id);
    return `${selectedNode.id}|${JSON.stringify(allTransforms)}`;
  }, [selectedNode, nodes, edges, getUpstreamTransforms]);

  const previewKey = getPreviewKey();

  // Effect to fetch preview when preview/python/sql node is selected or upstream state changes
  useEffect(() => {
    const previewNodeTypes = ['preview', 'python', 'sql'];
    if (!selectedNode || !previewNodeTypes.includes(selectedNode.data.type)) {
      setPreviewData(null);
      return;
    }

    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    // Get source dataset ID directly using refs
    const traceSourceDataset = (nodeId: string, visitedNodes: Set<string> = new Set()): string | null => {
      if (visitedNodes.has(nodeId)) return null;
      visitedNodes.add(nodeId);
      const node = currentNodes.find(n => n.id === nodeId);
      if (!node) return null;
      if (node.data.type === 'input' && node.data.datasetId) {
        return node.data.datasetId;
      }
      const incomingEdges = currentEdges.filter(e => e.target === nodeId);
      for (const edge of incomingEdges) {
        const result = traceSourceDataset(edge.source, visitedNodes);
        if (result) return result;
      }
      return null;
    };

    // Collect upstream filters directly using refs
    const collectFilters = (nodeId: string, visitedNodes: Set<string> = new Set()): Array<{ column: string; operator: string; value: any }> => {
      if (visitedNodes.has(nodeId)) return [];
      visitedNodes.add(nodeId);
      const node = currentNodes.find(n => n.id === nodeId);
      if (!node) return [];
      const filters: Array<{ column: string; operator: string; value: any }> = [];
      const filterOp = node.data.filterOp || 'eq';
      if (node.data.type === 'filter' && node.data.filterColumn) {
        const multiSelectOps = ['isin', 'notin'];
        const needsValue = !['isnull', 'notnull'].includes(filterOp);
        let value;
        let hasValidValue = true;
        if (multiSelectOps.includes(filterOp)) {
          value = node.data.filterValues || [];
          hasValidValue = value.length > 0;
        } else if (needsValue) {
          value = node.data.filterValue;
          hasValidValue = value !== undefined && value !== null && value !== '';
        } else {
          value = null;
        }
        if (hasValidValue) {
          filters.push({ column: node.data.filterColumn, operator: filterOp, value });
        }
      }
      const incomingEdges = currentEdges.filter(e => e.target === nodeId);
      for (const edge of incomingEdges) {
        filters.push(...collectFilters(edge.source, visitedNodes));
      }
      return filters;
    };

    // Collect ALL transforms from upstream nodes in topological order
    const collectTransforms = (nodeId: string, visitedNodes: Set<string> = new Set()): Array<{ type: 'filter' | 'python' | 'sql' | 'sampling'; data: any }> => {
      if (visitedNodes.has(nodeId)) return [];
      visitedNodes.add(nodeId);
      
      const node = currentNodes.find(n => n.id === nodeId);
      if (!node) return [];
      
      // First, get transforms from upstream nodes
      const incomingEdges = currentEdges.filter(e => e.target === nodeId);
      let transforms: Array<{ type: 'filter' | 'python' | 'sql' | 'sampling'; data: any }> = [];
      
      for (const edge of incomingEdges) {
        const upstreamTransforms = collectTransforms(edge.source, visitedNodes);
        transforms = [...transforms, ...upstreamTransforms];
      }
      
      // Then add this node's transform (if any)
      if (node.data.type === 'filter') {
        const multiSelectOps = ['isin', 'notin'];
        const noValueOps = ['isnull', 'notnull'];

        // Multi-condition filter builder (newer format) — send as one grouped transform
        const conditions: any[] = node.data.filterConditions || [];
        if (conditions.length > 0) {
          const normalised = conditions
            .filter((c: any) => c.column)
            .map((c: any) => {
              let value = c.value;
              if (multiSelectOps.includes(c.op)) value = c.values || [];
              else if (noValueOps.includes(c.op)) value = null;
              return { column: c.column, op: c.op, value, logic: c.logic || 'AND' };
            });
          if (normalised.length > 0) {
            transforms.push({ type: 'filter', data: { conditions: normalised } });
          }
        } else if (node.data.filterColumn) {
          // Legacy single-condition format
          const op = node.data.filterOp || 'eq';
          let value = node.data.filterValue;
          if (multiSelectOps.includes(op)) value = node.data.filterValues || [];
          else if (noValueOps.includes(op)) value = null;
          transforms.push({ type: 'filter', data: { column: node.data.filterColumn, operator: op, value } });
        }
      } else if (node.data.type === 'python' && node.data.code) {
        transforms.push({ type: 'python', data: node.data.code });
      } else if (node.data.type === 'sql' && node.data.query) {
        transforms.push({ type: 'sql', data: node.data.query });
      } else if (node.data.type === 'sampling' && node.data.samplingColumn) {
        transforms.push({ 
          type: 'sampling', 
          data: { 
            column: node.data.samplingColumn, 
            percent: node.data.samplePercent || 100,
            seed: node.data.samplingSeed ?? 42
          }
        });
      }
      
      return transforms;
    };

    const datasetId = traceSourceDataset(selectedNode.id);
    if (!datasetId) {
      setPreviewData(null);
      return;
    }

    const transforms = collectTransforms(selectedNode.id);
    const limit = selectedNode.data.previewRows || 10;
    let isCancelled = false;

    const doFetch = async () => {
      setPreviewLoading(true);
      try {
        let data;
        // Use the unified transform endpoint if there are any transforms
        if (transforms.length > 0) {
          const response = await fetch(`/api/datasets/${datasetId}/transform?limit=${limit}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transforms })
          });
          if (response.ok) {
            data = await response.json();
          } else {
            const errorData = await response.json();
            console.error('Transform error:', errorData.error);
          }
        } else {
          const response = await fetch(`/api/datasets/${datasetId}/preview?limit=${limit}`);
          if (response.ok) data = await response.json();
        }
        if (!isCancelled && data) {
          setPreviewData({ columns: data.columns, rows: data.rows, totalRows: data.totalRows });
        } else if (!isCancelled) {
          setPreviewData(null);
        }
      } catch (error) {
        console.error('Failed to fetch preview data:', error);
        if (!isCancelled) setPreviewData(null);
      } finally {
        if (!isCancelled) setPreviewLoading(false);
      }
    };

    doFetch();
    return () => { isCancelled = true; };
  }, [selectedNode?.id, selectedNode?.data.type, selectedNode?.data.previewRows, selectedNode?.data.code, selectedNode?.data.query, previewKey]);

  // Update preview/python/sql node metadata when preview data changes
  useEffect(() => {
    const previewNodeTypes = ['preview', 'python', 'sql'];
    if (selectedNode && previewNodeTypes.includes(selectedNode.data.type) && previewData) {
      const newRows = previewData.totalRows;
      const newCols = previewData.columns?.length || 0;
      const currentRows = selectedNode.data.stats?.rows;
      const currentCols = selectedNode.data.stats?.cols;
      
      // Skip update if stats already match to prevent unnecessary re-renders
      if (currentRows === newRows && currentCols === newCols) {
        return;
      }
      
      const newStats = { rows: newRows, cols: newCols };
      const newColumns = previewData.columns || [];
      
      // Update nodes
      setNodes(nds => nds.map(n => {
        if (n.id === selectedNode.id) {
          return {
            ...n,
            data: { ...n.data, stats: newStats, columns: newColumns }
          };
        }
        return n;
      }));
      
      // Also update selectedNode to keep it in sync
      setSelectedNode((prev: any) => prev && prev.id === selectedNode.id ? {
        ...prev,
        data: { ...prev.data, stats: newStats, columns: newColumns }
      } : prev);
    }
  }, [selectedNode?.id, selectedNode?.data.type, selectedNode?.data.stats?.rows, selectedNode?.data.stats?.cols, previewData, setNodes]);

  // Calculate output shapes for all nodes and update edges with labels
  useEffect(() => {
    const calculateShapes = async () => {
      const shapes: Record<string, { rows: number; cols: number }> = {};
      
      for (const node of nodes) {
        // Skip nodes that don't output data
        if (!['input', 'filter', 'python', 'sql', 'sampling'].includes(node.data.type)) continue;
        
        // Get the source dataset for this node
        const getDatasetId = (nodeId: string, visited: Set<string> = new Set()): string | null => {
          if (visited.has(nodeId)) return null;
          visited.add(nodeId);
          const n = nodes.find(nd => nd.id === nodeId);
          if (!n) return null;
          if (n.data.type === 'input' && n.data.datasetId) return n.data.datasetId;
          const incoming = edges.filter(e => e.target === nodeId);
          for (const edge of incoming) {
            const dsId = getDatasetId(edge.source, visited);
            if (dsId) return dsId;
          }
          return null;
        };
        
        const datasetId = getDatasetId(node.id);
        if (!datasetId) continue;
        
        // Get transforms up to and including this node
        const transforms = getUpstreamTransforms(node.id);
        
        try {
          let response;
          if (transforms.length > 0) {
            response = await fetch(`/api/datasets/${datasetId}/transform?limit=1`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transforms })
            });
          } else {
            response = await fetch(`/api/datasets/${datasetId}/preview?limit=1`);
          }
          
          if (response.ok) {
            const data = await response.json();
            shapes[node.id] = { rows: data.totalRows, cols: data.columns?.length || 0 };
          }
        } catch (err) {
          // Ignore errors for shape calculation
        }
      }
      
      setNodeOutputShapes(shapes);
    };
    
    // Debounce the calculation
    const timeoutId = setTimeout(calculateShapes, 500);
    return () => clearTimeout(timeoutId);
  }, [nodes, edges, getUpstreamTransforms]);

  // Update edges with shape labels
  useEffect(() => {
    setEdges(eds => eds.map(edge => {
      const sourceShape = nodeOutputShapes[edge.source];
      if (sourceShape) {
        return {
          ...edge,
          label: `${sourceShape.rows.toLocaleString()} × ${sourceShape.cols}`,
          labelStyle: { 
            fontSize: 10, 
            fontWeight: 500, 
            fill: '#475569',
            fontFamily: 'ui-monospace, monospace'
          },
          labelBgStyle: { 
            fill: '#f1f5f9', 
            fillOpacity: 0.9,
            rx: 4,
            ry: 4
          },
          labelBgPadding: [4, 6] as [number, number]
        };
      }
      return edge;
    }));
  }, [nodeOutputShapes, setEdges]);
  
  // Multi-select dropdown component for columns
  const ColumnMultiSelect = ({ 
    label, 
    selectedCols, 
    availableCols, 
    onChange,
    testId 
  }: { 
    label: string, 
    selectedCols: string[], 
    availableCols: string[], 
    onChange: (cols: string[]) => void,
    testId: string 
  }) => {
    const [open, setOpen] = useState(false);
    
    const toggleCol = (col: string) => {
      if (selectedCols.includes(col)) {
        onChange(selectedCols.filter(c => c !== col));
      } else {
        onChange([...selectedCols, col]);
      }
    };
    
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full h-8 justify-between font-mono text-xs"
            data-testid={testId}
          >
            <span className="truncate">
              {selectedCols.length > 0 ? selectedCols.join(', ') : 'Select columns...'}
            </span>
            <ChevronDown className="w-3 h-3 ml-2 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <ScrollArea className="max-h-48">
            {availableCols.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No columns available. Connect a data source.</p>
            ) : (
              <div className="space-y-1">
                {availableCols.map(col => (
                  <div 
                    key={col} 
                    className="flex items-center gap-2 p-1.5 hover:bg-muted rounded cursor-pointer"
                    onClick={() => toggleCol(col)}
                  >
                    <Checkbox 
                      checked={selectedCols.includes(col)} 
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() => toggleCol(col)}
                    />
                    <span className="text-xs font-mono">{col}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    );
  };
  
  const runPipeline = async () => {
    if (isRunning) return;
    
    if (!currentPipelineId) {
      toast.error("Please save the pipeline first");
      return;
    }
    
    setIsRunning(true);
    toast.info("Pipeline started...");

    // Reset all statuses (except inputs which stay success)
    setNodes((nds) => 
      nds.map(n => ({
        ...n,
        data: {
          ...n.data,
          status: n.data.type === 'input' ? 'success' : 'pending',
          errorMessage: undefined,
        }
      }))
    );
    setEdges((eds) => eds.map(e => ({ ...e, animated: true })));

    const runId = `run_${Date.now()}`;
    const startTime = Date.now();
    const nodeResultsCollected: Array<{ nodeId: string; label: string; status: string; rows: number }> = [];

    const finishRun = (success: boolean, message?: string, resultCount?: number) => {
      const duration = Date.now() - startTime;
      setIsRunning(false);
      setEdges((eds) => eds.map(e => ({ ...e, animated: false })));

      // Record in execution history
      setRunHistory(prev => [{
        id: runId,
        timestamp: new Date(),
        duration,
        success,
        nodeResults: [...nodeResultsCollected],
        errorMessage: success ? undefined : message,
      }, ...prev].slice(0, 20));

      if (success) {
        toast.success(`Pipeline completed${resultCount !== undefined ? `: ${resultCount} nodes processed` : ''}`);
      } else {
        toast.error(message || 'Pipeline execution failed');
      }
    };

    try {
      const response = await fetch(`/api/pipelines/${currentPipelineId}/execute`, { method: 'POST' });

      if (!response.ok || !response.body) {
        throw new Error('Failed to start pipeline execution');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const event of events) {
          if (!event.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(event.slice(6));

            if (parsed.type === 'progress') {
              const newStatus = parsed.status === 'completed' ? 'success' : parsed.status === 'error' ? 'error' : 'processing';
              const newStats = parsed.resultInfo ? { rows: parsed.resultInfo.rows || 0, cols: (parsed.resultInfo.columns || []).length } : undefined;
              const errorMessage = parsed.status === 'error' ? parsed.message : undefined;

              setNodes((nds) =>
                nds.map(n => {
                  if (n.id !== parsed.nodeId) return n;
                  return { ...n, data: { ...n.data, status: newStatus, ...(newStats ? { stats: newStats } : {}), ...(errorMessage !== undefined ? { errorMessage } : {}), ...(parsed.resultInfo ? { resultInfo: parsed.resultInfo } : {}) } };
                })
              );

              if (parsed.status === 'completed' || parsed.status === 'error') {
                const nd = nodesRef.current.find(n => n.id === parsed.nodeId);
                nodeResultsCollected.push({
                  nodeId: parsed.nodeId,
                  label: nd?.data?.label || parsed.nodeId,
                  status: parsed.status,
                  rows: parsed.resultInfo?.rows || 0,
                });

                // Store preview rows for hover tooltip
                if (parsed.resultInfo?.preview_rows && parsed.resultInfo?.columns) {
                  setNodePreviewData(prev => ({
                    ...prev,
                    [parsed.nodeId]: { rows: parsed.resultInfo.preview_rows, columns: parsed.resultInfo.columns }
                  }));
                }
              }
            } else if (parsed.type === 'result') {
              finishRun(parsed.success, parsed.error, Object.keys(parsed.results || {}).length);
            }
          } catch (_) {}
        }
      }
    } catch (error: any) {
      finishRun(false, error.message || 'Pipeline execution failed');
    }
  };
  
  // ---- Auto Layout ----
  const autoLayout = useCallback(() => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    if (currentNodes.length === 0) return;

    // Build adjacency + in-degree
    const inDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {};
    currentNodes.forEach(n => { inDegree[n.id] = 0; adj[n.id] = []; });
    currentEdges.forEach(e => {
      if (adj[e.source]) adj[e.source].push(e.target);
      if (inDegree[e.target] !== undefined) inDegree[e.target]++;
    });

    // Kahn's topological sort → assign columns
    const col: Record<string, number> = {};
    const queue = currentNodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
    let processed = 0;
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (col[id] === undefined) col[id] = 0;
      processed++;
      (adj[id] || []).forEach(child => {
        col[child] = Math.max(col[child] ?? 0, col[id] + 1);
        inDegree[child]--;
        if (inDegree[child] === 0) queue.push(child);
      });
    }
    // Fallback for disconnected nodes
    currentNodes.forEach(n => { if (col[n.id] === undefined) col[n.id] = 0; });

    // Assign row within each column
    const colBuckets: Record<number, string[]> = {};
    Object.entries(col).forEach(([id, c]) => {
      if (!colBuckets[c]) colBuckets[c] = [];
      colBuckets[c].push(id);
    });

    const NODE_W = 280, NODE_H = 120, H_GAP = 80, V_GAP = 40;
    const newPositions: Record<string, { x: number; y: number }> = {};
    Object.entries(colBuckets).forEach(([colIdx, ids]) => {
      const c = Number(colIdx);
      const totalH = ids.length * NODE_H + (ids.length - 1) * V_GAP;
      ids.forEach((id, rowIdx) => {
        newPositions[id] = {
          x: c * (NODE_W + H_GAP) + 60,
          y: -totalH / 2 + rowIdx * (NODE_H + V_GAP),
        };
      });
    });

    pushHistory(currentNodes, currentEdges);
    setNodes(nds => nds.map(n => ({ ...n, position: newPositions[n.id] ?? n.position })));
    toast.success('Layout applied');
  }, [pushHistory, setNodes]);

  // ---- Pre-run Validation ----
  const validatePipeline = useCallback((): Array<{ level: 'error' | 'warning'; message: string }> => {
    const ns = nodesRef.current;
    const es = edgesRef.current;
    const issues: Array<{ level: 'error' | 'warning'; message: string }> = [];

    const hasSource = ns.some(n => n.data.type === 'input');
    if (!hasSource) issues.push({ level: 'error', message: 'No Data Source node found. Add at least one Data Source to start the pipeline.' });

    const connectedIds = new Set<string>();
    es.forEach(e => { connectedIds.add(e.source); connectedIds.add(e.target); });
    const isolatedNonSource = ns.filter(n => n.data.type !== 'input' && n.data.type !== 'comment' && !connectedIds.has(n.id));
    if (isolatedNonSource.length > 0) {
      issues.push({ level: 'warning', message: `${isolatedNonSource.length} node(s) have no connections and will be skipped: ${isolatedNonSource.map(n => n.data.label).join(', ')}` });
    }

    const sourcesWithoutDataset = ns.filter(n => n.data.type === 'input' && n.data.sourceType === 'existing' && !n.data.datasetId);
    if (sourcesWithoutDataset.length > 0) {
      issues.push({ level: 'error', message: `${sourcesWithoutDataset.length} Data Source node(s) have no dataset selected.` });
    }

    const configNodes = ns.filter(n => n.data.type === 'config' || n.data.type === 'model_config');
    configNodes.forEach(n => {
      if (!n.data.cfgTargetVar) issues.push({ level: 'warning', message: `Model Config "${n.data.label}": Target variable not set.` });
      if (!n.data.cfgTimeCol) issues.push({ level: 'warning', message: `Model Config "${n.data.label}": Time column not set.` });
    });

    return issues;
  }, []);

  const handleRunWithValidation = useCallback(() => {
    const issues = validatePipeline();
    const errors = issues.filter(i => i.level === 'error');
    if (issues.length > 0) {
      setValidationIssues(issues);
      setValidationDialogOpen(true);
    } else {
      runPipeline();
    }
  }, [validatePipeline, runPipeline]);

  // ---- Fetch dataset column profile ----
  const fetchDatasetProfile = useCallback(async (datasetId: string) => {
    setDatasetProfile(null);
    setDatasetProfileLoading(true);
    try {
      const res = await fetch(`/api/datasets/${datasetId}/preview?rows=50`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const columns: string[] = data.columns || [];
      const rows: any[] = data.rows || [];

      const profile = columns.map(col => {
        const values = rows.map(r => r[col]);
        const nullCount = values.filter(v => v === null || v === undefined || v === '').length;
        const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
        const sample = nonNull[0] !== undefined ? String(nonNull[0]) : '—';
        const isNum = nonNull.every(v => !isNaN(Number(v)));
        return { name: col, type: isNum ? 'numeric' : 'text', nullCount, sample };
      });
      setDatasetProfile(profile);
    } catch {
      setDatasetProfile(null);
    } finally {
      setDatasetProfileLoading(false);
    }
  }, []);

  // Auto-fetch dataset profile when a Data Source node is selected
  useEffect(() => {
    if (
      selectedNode &&
      selectedNode.data.type === 'input' &&
      selectedNode.data.sourceType === 'existing' &&
      selectedNode.data.datasetId
    ) {
      fetchDatasetProfile(selectedNode.data.datasetId);
    } else {
      setDatasetProfile(null);
    }
  }, [selectedNode?.id, selectedNode?.data?.datasetId, fetchDatasetProfile]);

  const onNodeDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    event.dataTransfer.setData('application/reactflow/label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  // Click-to-add for touch devices
  const onAddNode = useCallback((nodeType: string, label: string) => {
    // Calculate a position in the center of the visible viewport
    const viewportCenter = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    
    // Offset each new node slightly to avoid stacking
    const offset = nodesRef.current.length * 30;

    pushHistory(nodesRef.current, edgesRef.current);
    const newNode = {
      id: getId(),
      type: 'custom',
      position: { x: viewportCenter.x + offset, y: viewportCenter.y + offset },
      data: { 
        label: label, 
        type: nodeType, 
        stats: { rows: 0, cols: 0 },
        status: 'pending'
      },
    };

    setNodes((nds) => nds.concat(newNode));
    setSelectedNode(newNode);
  }, [screenToFlowPosition, setNodes, pushHistory]);

  return (
    <div className="flex h-full w-full bg-slate-50 overflow-hidden relative">
      <div className="flex-1 relative h-full" ref={reactFlowWrapper}>
        {/* Hidden file input for JSON import */}
        <input
          ref={importFileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) { importPipelineJson(file); e.target.value = ''; }
          }}
        />

        {/* Header Actions Portal */}
        {headerPortal && createPortal(
          <>
            {currentPipelineId && pipelineName && (
              <span className="text-xs text-muted-foreground border-r pr-3 mr-1 truncate max-w-[180px]" data-testid="text-pipeline-name">
                {pipelineName}
              </span>
            )}
            {/* Undo / Redo */}
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" data-testid="button-undo">
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" data-testid="button-redo">
              <Redo2 className="w-3.5 h-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" data-testid="button-file-menu">
                  <FileText className="w-3.5 h-3.5" />
                  File
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => {
                  historyRef.current = [];
                  historyIndexRef.current = -1;
                  setCanUndo(false);
                  setCanRedo(false);
                  setNodes([]);
                  setEdges([]);
                  setCurrentPipelineId(null);
                  setPipelineName('');
                  setPipelineDescription('');
                  setSelectedNode(null);
                  toast.success('New pipeline created');
                }} data-testid="menu-new">
                  <FilePlus className="w-4 h-4 mr-2" />
                  New Pipeline
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setLoadDialogTab('saved'); setLoadDialogOpen(true); }} data-testid="menu-load">
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Open Pipeline
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setLoadDialogTab('templates'); setLoadDialogOpen(true); }} data-testid="menu-templates">
                  <LayoutTemplate className="w-4 h-4 mr-2" />
                  New from Template
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  if (currentPipelineId) {
                    updatePipeline.mutate({ id: currentPipelineId, data: { name: pipelineName, description: pipelineDescription, nodes, edges } });
                  } else {
                    setSaveDialogOpen(true);
                  }
                }} data-testid="menu-save">
                  <Save className="w-4 h-4 mr-2" />
                  {currentPipelineId ? 'Save Pipeline' : 'Save As...'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setSaveAsNew(true);
                  setStashedPipelineName(pipelineName);
                  setStashedPipelineDescription(pipelineDescription);
                  setPipelineName('');
                  setPipelineDescription('');
                  setSaveDialogOpen(true);
                }} data-testid="menu-save-as">
                  <Save className="w-4 h-4 mr-2" />
                  Save As New...
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportPipelineJson} data-testid="menu-export-json">
                  <Download className="w-4 h-4 mr-2" />
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => importFileRef.current?.click()} data-testid="menu-import-json">
                  <Upload className="w-4 h-4 mr-2" />
                  Import from JSON
                </DropdownMenuItem>
                {currentPipelineId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this pipeline?')) {
                          deletePipeline.mutate(currentPipelineId, {
                            onSuccess: () => {
                              setNodes([]);
                              setEdges([]);
                              setCurrentPipelineId(null);
                              setPipelineName('');
                              setPipelineDescription('');
                              setSelectedNode(null);
                              setLoadDialogOpen(false);
                              setSaveDialogOpen(false);
                            },
                          });
                        }
                      }}
                      data-testid="menu-delete"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Pipeline
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={autoLayout} title="Auto-layout nodes" data-testid="button-auto-layout">
              <LayoutGrid className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className={`h-8 w-8 p-0 relative ${runHistory.length > 0 ? 'text-blue-600' : ''}`} onClick={() => setHistoryPanelOpen(true)} title="Execution history" data-testid="button-history">
              <ClockIcon className="w-3.5 h-3.5" />
              {runHistory.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full" />}
            </Button>
            <Button 
              size="sm" 
              className={`h-8 gap-1.5 text-xs ${isRunning ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}
              onClick={handleRunWithValidation}
              disabled={isRunning}
              data-testid="button-run-pipeline"
            >
              {isRunning ? <span className="animate-spin">⟳</span> : <Play className="w-3.5 h-3.5" />} 
              {isRunning ? 'Running...' : 'Run'}
            </Button>
          </>,
          headerPortal
        )}

        {/* Load Pipeline Dialog */}
        <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Open Pipeline</DialogTitle>
              <DialogDescription>
                Load a saved pipeline or start from a template.
              </DialogDescription>
            </DialogHeader>
            <Tabs value={loadDialogTab} onValueChange={(v) => setLoadDialogTab(v as 'saved' | 'templates')} className="mt-2">
              <TabsList className="w-full">
                <TabsTrigger value="saved" className="flex-1" data-testid="tab-saved-pipelines">
                  <FolderOpen className="w-3.5 h-3.5 mr-1.5" />Saved
                </TabsTrigger>
                <TabsTrigger value="templates" className="flex-1" data-testid="tab-templates">
                  <LayoutTemplate className="w-3.5 h-3.5 mr-1.5" />Templates
                </TabsTrigger>
              </TabsList>

              <TabsContent value="saved">
                <ScrollArea className="h-[320px] mt-2 pr-4">
                   <div className="space-y-2">
                      {pipelinesLoading ? (
                        <div className="text-center py-4 text-muted-foreground">Loading pipelines...</div>
                      ) : savedPipelines.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No saved pipelines yet</p>
                          <p className="text-xs mt-1">Create and save your first pipeline</p>
                        </div>
                      ) : (
                        savedPipelines.map((pipeline) => (
                         <button
                            key={pipeline.id}
                            className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent hover:border-primary/50 transition-all group relative"
                            onClick={() => loadPipeline(pipeline)}
                            data-testid={`button-load-pipeline-${pipeline.id}`}
                         >
                            <div className="flex items-center justify-between mb-1">
                               <span className="font-medium group-hover:text-primary transition-colors">{pipeline.name}</span>
                               <div className="flex items-center gap-2">
                                 <span className="text-xs text-muted-foreground">{new Date(pipeline.updatedAt).toLocaleDateString()}</span>
                                 <Button
                                   variant="ghost"
                                   size="icon"
                                   className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     if (window.confirm('Are you sure you want to delete this pipeline?')) {
                                       deletePipeline.mutate(pipeline.id, {
                                         onSuccess: () => {
                                           if (currentPipelineId === pipeline.id) {
                                             setNodes([]);
                                             setEdges([]);
                                             setCurrentPipelineId(null);
                                             setPipelineName('');
                                             setPipelineDescription('');
                                             setSelectedNode(null);
                                           }
                                         },
                                       });
                                     }
                                   }}
                                   data-testid={`button-delete-pipeline-${pipeline.id}`}
                                 >
                                   <Trash2 className="w-3.5 h-3.5" />
                                 </Button>
                               </div>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1">{pipeline.description}</p>
                            <div className="mt-2 text-xs flex gap-2">
                               <span className="bg-secondary px-1.5 py-0.5 rounded">{Array.isArray(pipeline.nodes) ? pipeline.nodes.length : 0} Nodes</span>
                            </div>
                         </button>
                        ))
                      )}
                   </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="templates">
                <ScrollArea className="h-[320px] mt-2 pr-4">
                  <div className="space-y-2">
                    {PIPELINE_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.name}
                        className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent hover:border-primary/50 transition-all group"
                        onClick={() => {
                          // Push before state, then also push the template state so undo works
                          const beforeNodes = JSON.parse(JSON.stringify(nodesRef.current));
                          const beforeEdges = JSON.parse(JSON.stringify(edgesRef.current));
                          const afterNodes = JSON.parse(JSON.stringify(tmpl.nodes));
                          const afterEdges = JSON.parse(JSON.stringify(tmpl.edges));
                          const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
                          newHistory.push({ nodes: beforeNodes, edges: beforeEdges });
                          newHistory.push({ nodes: afterNodes, edges: afterEdges });
                          if (newHistory.length > 50) newHistory.splice(0, newHistory.length - 50);
                          historyRef.current = newHistory;
                          historyIndexRef.current = newHistory.length - 1;
                          setCanUndo(true);
                          setCanRedo(false);
                          setNodes(tmpl.nodes as any);
                          setEdges(tmpl.edges as any);
                          setCurrentPipelineId(null);
                          setPipelineName(tmpl.name);
                          setPipelineDescription(tmpl.description);
                          setSelectedNode(null);
                          setLoadDialogOpen(false);
                          toast.success(`Template "${tmpl.name}" loaded`);
                        }}
                        data-testid={`button-load-template-${tmpl.name.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <LayoutTemplate className="w-4 h-4 text-violet-500" />
                          <span className="font-medium group-hover:text-primary transition-colors">{tmpl.name}</span>
                          <span className="ml-auto text-xs bg-secondary px-1.5 py-0.5 rounded">{tmpl.nodes.length} Nodes</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{tmpl.description}</p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* Save Pipeline Dialog */}
        <Dialog open={saveDialogOpen} onOpenChange={handleCloseSaveDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{saveAsNew ? 'Save As New Pipeline' : (currentPipelineId ? 'Save Pipeline' : 'Save Pipeline As')}</DialogTitle>
              <DialogDescription>
                {currentPipelineId ? 'Update your pipeline configuration.' : 'Save your pipeline configuration for later use.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="pipeline-name">Pipeline Name</Label>
                <Input 
                  id="pipeline-name" 
                  placeholder="e.g., Q3 Sales Forecast" 
                  value={pipelineName}
                  onChange={(e) => setPipelineName(e.target.value)}
                  data-testid="input-pipeline-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pipeline-description">Description (optional)</Label>
                <Textarea 
                  id="pipeline-description" 
                  placeholder="Describe what this pipeline does..."
                  value={pipelineDescription}
                  onChange={(e) => setPipelineDescription(e.target.value)}
                  data-testid="input-pipeline-description"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleCloseSaveDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSavePipeline} data-testid="button-confirm-save">
                  {saveAsNew ? 'Save As New' : (currentPipelineId ? 'Save' : 'Save Pipeline')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* ── Validation Dialog ── */}
        <Dialog open={validationDialogOpen} onOpenChange={setValidationDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                Pipeline Check
              </DialogTitle>
              <DialogDescription>
                Review these issues before running the pipeline.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-64 mt-2">
              <div className="space-y-2">
                {validationIssues.map((issue, i) => (
                  <div key={i} className={`flex gap-2 items-start p-2.5 rounded-lg text-xs ${issue.level === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
                    {issue.level === 'error'
                      ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      : <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />}
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setValidationDialogOpen(false)}>Fix Issues</Button>
              <Button
                disabled={validationIssues.some(i => i.level === 'error')}
                onClick={() => { setValidationDialogOpen(false); runPipeline(); }}
                data-testid="button-run-anyway"
              >
                Run Anyway
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Execution History Panel ── */}
        <Dialog open={historyPanelOpen} onOpenChange={setHistoryPanelOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Execution History
              </DialogTitle>
              <DialogDescription>Last {runHistory.length} pipeline run{runHistory.length !== 1 ? 's' : ''}.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[380px] mt-2">
              {runHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No runs yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {runHistory.map((run) => (
                    <div key={run.id} className={`border rounded-lg p-3 ${run.success ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/40'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {run.success
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            : <AlertCircle className="w-4 h-4 text-red-500" />}
                          <span className="text-sm font-medium">{run.success ? 'Success' : 'Failed'}</span>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>{run.timestamp.toLocaleTimeString()}</div>
                          <div>{(run.duration / 1000).toFixed(1)}s</div>
                        </div>
                      </div>
                      {run.errorMessage && (
                        <p className="text-xs text-red-600 mb-2 font-mono bg-red-100 px-2 py-1 rounded">{run.errorMessage}</p>
                      )}
                      <div className="space-y-1">
                        {run.nodeResults.map((nr) => (
                          <div key={nr.nodeId} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600 truncate max-w-[200px]">{nr.label}</span>
                            <div className="flex items-center gap-2">
                              {nr.rows > 0 && <span className="text-muted-foreground">{nr.rows.toLocaleString()} rows</span>}
                              <span className={`px-1.5 py-0.5 rounded font-medium ${nr.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {nr.status === 'completed' ? '✓' : '✗'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <ReactFlow
          nodes={nodes.map(n => ({
            ...n,
            data: {
              ...n.data,
              previewRows: nodePreviewData[n.id]?.rows,
              previewColumns: nodePreviewData[n.id]?.columns,
              onCommentChange: n.data.type === 'comment' ? (text: string) => {
                setNodes(nds => nds.map(nd => nd.id === n.id ? { ...nd, data: { ...nd.data, commentText: text, label: text.slice(0, 30) || 'Comment' } } : nd));
              } : undefined,
            }
          }))}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={() => { onPaneClick(); if (!quickConnectJustOpened.current) setQuickConnectMenu(null); setContextMenu(null); }}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
        >
          <Controls className="bg-white border-border shadow-sm" />
          <MiniMap className="border border-border shadow-sm rounded-lg overflow-hidden" zoomable pannable />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#cbd5e1" />
          
          {selectedNode && (
            <Panel position="top-right" className="m-0 mt-16 mr-4">
              <Card className="w-96 shadow-xl border-border/50 backdrop-blur-sm bg-white/95 max-h-[80vh] overflow-y-auto">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Node Configuration</CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedNode(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="node-label">Label</Label>
                    <Input 
                      id="node-label" 
                      value={selectedNode.data.label} 
                      onChange={(e) => updateNodeLabel(e.target.value)} 
                    />
                  </div>
                  
                  {/* Connect From dropdown for non-input nodes */}
                  {selectedNode.data.type !== 'input' && (
                    <div className="space-y-2 border rounded-md p-3 bg-slate-50">
                      <Label className="flex items-center gap-2">
                        <GitMerge className="w-3.5 h-3.5" />
                        Connect From
                      </Label>
                      {getCurrentSources().length > 0 && (
                        <div className="space-y-1 mb-2">
                          {getCurrentSources().map((src) => (
                            <div key={src.edgeId} className="flex items-center justify-between bg-white rounded px-2 py-1 border text-xs">
                              <span className="font-medium truncate">{src.sourceLabel}</span>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-5 w-5 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => disconnectSource(src.edgeId)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <Select onValueChange={connectFromNode} value="">
                        <SelectTrigger className="h-8 text-xs" data-testid="select-connect-from">
                          <SelectValue placeholder="+ Add connection..." />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableSourceNodes().length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">No source nodes available</div>
                          ) : (
                            getAvailableSourceNodes().map(node => (
                              <SelectItem key={node.id} value={node.id} className="text-xs">
                                {node.data.label} ({node.data.type})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* Error message banner */}
                  {selectedNode.data.status === 'error' && selectedNode.data.errorMessage && (
                    <div className="rounded-md bg-red-50 border border-red-200 p-3 flex gap-2 items-start" data-testid="node-error-banner">
                      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-red-700 mb-0.5">Execution Error</p>
                        <p className="text-xs text-red-600 font-mono break-all whitespace-pre-wrap">{selectedNode.data.errorMessage}</p>
                      </div>
                    </div>
                  )}

                  {(selectedNode.data.type === 'input') && (
                     <div className="space-y-4">
                        <div className="space-y-2">
                           <Label>Source Type</Label>
                           <Select 
                              value={selectedNode.data.sourceType || 'file'} 
                              onValueChange={(val) => updateNodeData('sourceType', val)}
                           >
                             <SelectTrigger className="h-8" data-testid="select-source-type">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="file">File Upload (CSV, Excel)</SelectItem>
                               <SelectItem value="existing">Existing Dataset</SelectItem>
                               <SelectItem value="sql">SQL Query</SelectItem>
                             </SelectContent>
                           </Select>
                        </div>
                        
                        {(selectedNode.data.sourceType === 'existing') ? (
                           <div className="space-y-2">
                              <Label>Select Dataset</Label>
                              <Select 
                                 value={selectedNode.data.datasetId || ''} 
                                 onValueChange={(val) => {
                                   const dataset = datasets?.find(d => d.id === val);
                                   if (dataset) {
                                     updateNodeData('datasetId', val);
                                     updateNodeData('label', dataset.filename);
                                     setNodes(nds => nds.map(n => {
                                       if (n.id === selectedNode.id) {
                                         return {
                                           ...n,
                                           data: {
                                             ...n.data,
                                             datasetId: val,
                                             label: dataset.filename,
                                             columns: dataset.columns || [],
                                             stats: {
                                               rows: dataset.rows,
                                               cols: dataset.cols
                                             }
                                           }
                                         };
                                       }
                                       return n;
                                     }));
                                     fetchDatasetProfile(val);
                                   }
                                 }}
                              >
                                <SelectTrigger className="h-8" data-testid="select-existing-dataset">
                                  <SelectValue placeholder="Choose a dataset..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {datasets?.map(dataset => (
                                    <SelectItem key={dataset.id} value={dataset.id} className="text-xs">
                                      <div className="flex flex-col">
                                        <span>{dataset.filename}</span>
                                        <span className="text-muted-foreground text-[10px]">{dataset.rows} rows × {dataset.cols} cols</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {selectedNode.data.datasetId && (
                                <div className="space-y-2">
                                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded flex justify-between items-center">
                                    <span className="font-medium text-slate-700">{selectedNode.data.label}</span>
                                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => fetchDatasetProfile(selectedNode.data.datasetId)} title="Refresh profile">
                                      <ClockIcon className="w-3 h-3" />
                                    </Button>
                                  </div>
                                  {datasetProfileLoading && (
                                    <div className="text-xs text-muted-foreground text-center py-2">Loading column profile…</div>
                                  )}
                                  {datasetProfile && !datasetProfileLoading && (
                                    <div className="border rounded-md overflow-hidden">
                                      <div className="bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide flex gap-2">
                                        <span className="flex-1">Column</span>
                                        <span className="w-14 text-right">Type</span>
                                        <span className="w-12 text-right">Nulls</span>
                                      </div>
                                      <ScrollArea className="max-h-40">
                                        {datasetProfile.map((col) => (
                                          <div key={col.name} className="flex gap-2 items-center px-2 py-1 text-[11px] border-t hover:bg-muted/30">
                                            <span className="flex-1 truncate font-mono text-slate-700" title={col.name}>{col.name}</span>
                                            <span className={`w-14 text-right px-1 rounded text-[10px] font-medium ${col.type === 'numeric' ? 'text-blue-600 bg-blue-50' : 'text-amber-600 bg-amber-50'}`}>{col.type}</span>
                                            <span className={`w-12 text-right text-[10px] ${col.nullCount > 0 ? 'text-orange-600 font-medium' : 'text-muted-foreground'}`}>{col.nullCount > 0 ? col.nullCount : '—'}</span>
                                          </div>
                                        ))}
                                      </ScrollArea>
                                    </div>
                                  )}
                                </div>
                              )}
                           </div>
                        ) : (selectedNode.data.sourceType === 'sql') ? (
                           <div className="space-y-3 border rounded-md p-3 bg-cyan-50/50 border-cyan-100">
                              <div className="space-y-2">
                                 <Label>Connection String</Label>
                                 <Input 
                                    placeholder="postgresql://user:pass@host:5432/db" 
                                    className="h-8 font-mono text-xs"
                                    value={selectedNode.data.connectionString || ''}
                                    onChange={(e) => updateNodeData('connectionString', e.target.value)}
                                    data-testid="input-connection-string"
                                 />
                              </div>
                              <div className="space-y-2">
                                 <Label className="flex justify-between">
                                    <span>SQL Query</span>
                                    <span className="text-[10px] text-muted-foreground font-mono">PostgreSQL</span>
                                 </Label>
                                 <div 
                                    className="h-32 border rounded-md overflow-hidden"
                                    onKeyDown={(e) => e.stopPropagation()}
                                    onKeyUp={(e) => e.stopPropagation()}
                                    onKeyPress={(e) => e.stopPropagation()}
                                 >
                                    <Editor
                                       height="100%"
                                       defaultLanguage="sql"
                                       value={selectedNode.data.sqlQuery || "SELECT * FROM sales_data\nWHERE date >= '2024-01-01'\nORDER BY date"}
                                       theme="light"
                                       options={{ minimap: { enabled: false }, fontSize: 11, lineNumbers: 'off' }}
                                       onChange={(val) => updateNodeData('sqlQuery', val)}
                                    />
                                 </div>
                              </div>
                           </div>
                        ) : (
                           <div className="space-y-2">
                              <Label>Upload File</Label>
                              <FileDropzone compact onUploadComplete={handleFileUpload} />
                           </div>
                        )}
                     </div>
                  )}

                  {selectedNode.data.type === 'config' && (() => {
                    const modelMode = selectedNode.data.modelMode || 'train';
                    const dataFrequency = selectedNode.data.dataFrequency || 'monthly';
                    const freqUnitMap: Record<string, string> = { daily: 'days', weekly: 'weeks', monthly: 'months', quarterly: 'quarters', yearly: 'years' };
                    const freqUnit = freqUnitMap[dataFrequency] || 'periods';
                    const forecastHorizon = selectedNode.data.forecastHorizon ?? 12;
                    const backtestEnabled = selectedNode.data.backtestEnabled ?? false;
                    const backtestFolds = selectedNode.data.backtestFolds ?? 3;
                    const backtestStepSize = selectedNode.data.backtestStepSize ?? forecastHorizon;
                    const backtestGap = selectedNode.data.backtestGap ?? 0;

                    let trainPeriods = 24;
                    if (selectedNode.data.trainStart && selectedNode.data.trainEnd) {
                      const start = new Date(selectedNode.data.trainStart);
                      const end = new Date(selectedNode.data.trainEnd);
                      const diffMs = end.getTime() - start.getTime();
                      trainPeriods = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44)));
                    }

                    const folds: Array<{ train: number; test: number; gap: number; inference: number }> = [];
                    if (backtestEnabled && backtestFolds > 0) {
                      for (let i = 0; i < backtestFolds; i++) {
                        const foldTrain = trainPeriods - (backtestFolds - 1 - i) * backtestStepSize;
                        const isLast = i === backtestFolds - 1;
                        folds.push({
                          train: Math.max(1, foldTrain),
                          test: forecastHorizon,
                          gap: backtestGap,
                          inference: isLast ? forecastHorizon : 0,
                        });
                      }
                    } else {
                      folds.push({ train: trainPeriods, test: 0, gap: 0, inference: forecastHorizon });
                    }

                    const maxTotal = Math.max(...folds.map(f => f.train + f.gap + f.test + f.inference));

                    return (
                    <div className="space-y-5 border rounded-md p-4 bg-purple-50/50 border-purple-100">
                       <div>
                          <h4 className="text-sm font-semibold text-purple-900 mb-1">Model Configuration</h4>
                          <p className="text-xs text-purple-700">Plan your model training, backtesting, and forecast strategy.</p>
                       </div>

                       <details className="group border rounded-lg" open>
                         <summary className="flex items-center justify-between p-3 cursor-pointer text-xs font-semibold hover:bg-muted/50">
                           Training & Backtesting
                           <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                         </summary>
                         <div className="px-3 pb-3 space-y-5">
                       <div>
                          <Label className="text-xs font-medium mb-1.5 block">Model Source</Label>
                          <div className="flex rounded-md border overflow-hidden" data-testid="model-mode-toggle">
                             <button
                                className={cn("flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors", modelMode === 'train' ? "bg-purple-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50")}
                                onClick={() => updateNodeData('modelMode', 'train')}
                                data-testid="model-mode-train"
                             >
                                <Cpu className="w-3.5 h-3.5" /> Train
                             </button>
                             <button
                                className={cn("flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l", modelMode === 'load' ? "bg-purple-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50")}
                                onClick={() => updateNodeData('modelMode', 'load')}
                                data-testid="model-mode-load"
                             >
                                <Upload className="w-3.5 h-3.5" /> Load
                             </button>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                             {modelMode === 'train' ? 'Build a new model from your data' : 'Use a previously trained model'}
                          </p>
                       </div>

                       <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">Data Frequency</Label>
                            <Button
                              size="sm" variant="ghost"
                              className="h-5 text-[10px] px-1.5 gap-1 text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                              onClick={async () => {
                                const timeCol = selectedNode.data.cfgTimeCol || selectedNode.data.configDateColumn;
                                if (!timeCol) { toast.error('Set the timestamp column first'); return; }
                                const datasetId = getSourceDatasetId(selectedNode.id);
                                if (!datasetId) { toast.error('Connect a data source upstream first'); return; }
                                try {
                                  const res = await fetch(`/api/datasets/${datasetId}/preview?rows=200`);
                                  if (!res.ok) throw new Error();
                                  const data = await res.json();
                                  const vals: number[] = (data.rows || [])
                                    .map((r: any) => new Date(r[timeCol]).getTime())
                                    .filter((v: number) => !isNaN(v))
                                    .sort((a: number, b: number) => a - b);
                                  if (vals.length < 2) { toast.error('Not enough date values to detect'); return; }
                                  const diffs = vals.slice(1).map((v, i) => v - vals[i]);
                                  const medianDiff = diffs.sort((a, b) => a - b)[Math.floor(diffs.length / 2)];
                                  const days = medianDiff / 86400000;
                                  let detected = 'monthly';
                                  if (days <= 2) detected = 'daily';
                                  else if (days <= 10) detected = 'weekly';
                                  else if (days <= 50) detected = 'monthly';
                                  else if (days <= 120) detected = 'quarterly';
                                  else detected = 'yearly';
                                  updateNodeData('dataFrequency', detected);
                                  toast.success(`Detected: ${detected} (median gap ${Math.round(days)}d)`);
                                } catch { toast.error('Could not detect frequency'); }
                              }}
                              data-testid="button-detect-frequency"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Detect
                            </Button>
                          </div>
                          <select
                             value={dataFrequency}
                             onChange={(e) => updateNodeData('dataFrequency', e.target.value)}
                             className="w-full h-8 text-xs rounded-md border border-input bg-background px-3 ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                             data-testid="select-data-frequency"
                          >
                             <option value="daily">Daily</option>
                             <option value="weekly">Weekly</option>
                             <option value="monthly">Monthly</option>
                             <option value="quarterly">Quarterly</option>
                             <option value="yearly">Yearly</option>
                          </select>
                       </div>

                       <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Date Column</Label>
                          <select
                             value={selectedNode.data.configDateColumn || ''}
                             onChange={(e) => {
                                updateNodeData('configDateColumn', e.target.value);
                                const range = dateColumnRanges[e.target.value];
                                if (range) {
                                   setConfigDateRange(range);
                                   updateNodeData('trainStart', range.minDate);
                                   updateNodeData('trainEnd', range.maxDate);
                                } else {
                                   setConfigDateRange(null);
                                }
                             }}
                             className="w-full h-8 text-xs rounded-md border border-input bg-background px-3 ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                             data-testid="select-date-column"
                          >
                             <option value="">Select date column...</option>
                             {getNodeColumns(selectedNode.id).map(col => {
                                const range = dateColumnRanges[col];
                                return (
                                   <option key={col} value={col}>
                                      {col}{range ? ` (${range.minDate} → ${range.maxDate})` : ''}
                                   </option>
                                );
                             })}
                          </select>
                       </div>

                       {modelMode === 'train' ? (
                          <div className="space-y-3">
                             <Label className="text-xs font-medium">Training Period</Label>
                             <p className="text-[10px] text-muted-foreground -mt-1">The model trains on data between these dates. Backtest folds are carved from within this window — the model never sees data beyond Train End.</p>
                             <div className="grid grid-cols-2 gap-3">
                                <div>
                                   <Label className="text-[10px] text-muted-foreground mb-1 block">Train Start</Label>
                                   <Input
                                      type="date"
                                      value={selectedNode.data.trainStart || ''}
                                      onChange={(e) => updateNodeData('trainStart', e.target.value)}
                                      min={configDateRange?.minDate}
                                      max={configDateRange?.maxDate}
                                      className="h-8 text-xs"
                                      data-testid="input-train-start"
                                   />
                                </div>
                                <div>
                                   <Label className="text-[10px] text-muted-foreground mb-1 block">Train End</Label>
                                   <Input
                                      type="date"
                                      value={selectedNode.data.trainEnd || ''}
                                      onChange={(e) => updateNodeData('trainEnd', e.target.value)}
                                      min={configDateRange?.minDate}
                                      max={configDateRange?.maxDate}
                                      className="h-8 text-xs"
                                      data-testid="input-train-end"
                                   />
                                </div>
                             </div>
                          </div>
                       ) : (
                          <div className="space-y-2">
                             <Label className="text-xs font-medium">Model Path</Label>
                             <Input
                                type="text"
                                placeholder="path/to/model"
                                value={selectedNode.data.modelPath || ''}
                                onChange={(e) => updateNodeData('modelPath', e.target.value)}
                                className="h-8 text-xs"
                                data-testid="input-model-path"
                             />
                          </div>
                       )}

                       <div className="space-y-2">
                          <Label className="text-xs font-medium">Forecast Horizon</Label>
                          <div className="flex items-center gap-2">
                             <Input
                                type="number"
                                min={1}
                                value={selectedNode.data.forecastHorizon ?? 12}
                                onChange={(e) => {
                                   const raw = e.target.value;
                                   if (raw === '') { updateNodeData('forecastHorizon', ''); return; }
                                   const val = parseInt(raw);
                                   if (!isNaN(val)) updateNodeData('forecastHorizon', val);
                                }}
                                onBlur={() => {
                                   const v = selectedNode.data.forecastHorizon;
                                   if (v === '' || v === undefined || v === null || (typeof v === 'number' && v < 1)) updateNodeData('forecastHorizon', 1);
                                }}
                                className="h-8 text-xs w-20"
                                data-testid="input-forecast-horizon"
                             />
                             <span className="text-[10px] text-muted-foreground">{freqUnit} ahead</span>
                          </div>
                       </div>

                       <div className="space-y-3">
                          <div className="flex items-center justify-between">
                             <Label className="text-xs font-medium">Enable Backtesting</Label>
                             <Switch
                                checked={backtestEnabled}
                                onCheckedChange={(checked) => updateNodeData('backtestEnabled', checked)}
                                data-testid="switch-backtest"
                             />
                          </div>

                          {backtestEnabled && (
                             <div className="space-y-3 pl-1">
                                <div className="space-y-1">
                                   <Label className="text-[10px] text-muted-foreground">Number of Folds</Label>
                                   <Input
                                      type="number"
                                      min={1}
                                      value={selectedNode.data.backtestFolds ?? 3}
                                      onChange={(e) => {
                                         const raw = e.target.value;
                                         if (raw === '') { updateNodeData('backtestFolds', ''); return; }
                                         const val = parseInt(raw);
                                         if (!isNaN(val)) updateNodeData('backtestFolds', val);
                                      }}
                                      onBlur={() => {
                                         const v = selectedNode.data.backtestFolds;
                                         if (v === '' || v === undefined || v === null) { updateNodeData('backtestFolds', 1); return; }
                                         if (typeof v === 'number') updateNodeData('backtestFolds', Math.max(1, v));
                                      }}
                                      className="h-8 text-xs w-20"
                                      data-testid="input-backtest-folds"
                                   />
                                </div>
                                <div className="space-y-1">
                                   <Label className="text-[10px] text-muted-foreground">Step Size</Label>
                                   <div className="flex items-center gap-2">
                                      <Input
                                         type="number"
                                         min={1}
                                         value={selectedNode.data.backtestStepSize ?? forecastHorizon}
                                         onChange={(e) => {
                                            const raw = e.target.value;
                                            if (raw === '') { updateNodeData('backtestStepSize', ''); return; }
                                            const val = parseInt(raw);
                                            if (!isNaN(val)) updateNodeData('backtestStepSize', val);
                                         }}
                                         onBlur={() => {
                                            const v = selectedNode.data.backtestStepSize;
                                            if (v === '' || (typeof v === 'number' && v < 1)) updateNodeData('backtestStepSize', 1);
                                         }}
                                         className="h-8 text-xs w-20"
                                         data-testid="input-backtest-step"
                                      />
                                      <span className="text-[10px] text-muted-foreground">{freqUnit} between folds</span>
                                   </div>
                                   {(selectedNode.data.backtestStepSize === undefined || selectedNode.data.backtestStepSize === null) && (
                                      <p className="text-[9px] text-purple-500">Defaults to forecast horizon ({forecastHorizon} {freqUnit})</p>
                                   )}
                                </div>
                                <div className="space-y-1">
                                   <Label className="text-[10px] text-muted-foreground">Gap</Label>
                                   <div className="flex items-center gap-2">
                                      <Input
                                         type="number"
                                         min={0}
                                         value={selectedNode.data.backtestGap ?? 0}
                                         onChange={(e) => {
                                            const raw = e.target.value;
                                            if (raw === '') { updateNodeData('backtestGap', ''); return; }
                                            const val = parseInt(raw);
                                            if (!isNaN(val)) updateNodeData('backtestGap', val);
                                         }}
                                         onBlur={() => {
                                            const v = selectedNode.data.backtestGap;
                                            if (v === '' || v === undefined || v === null) updateNodeData('backtestGap', 0);
                                            if (typeof v === 'number' && v < 0) updateNodeData('backtestGap', 0);
                                         }}
                                         className="h-8 text-xs w-20"
                                         data-testid="input-backtest-gap"
                                      />
                                      <span className="text-[10px] text-muted-foreground">{freqUnit} gap between train and test</span>
                                   </div>
                                </div>
                             </div>
                          )}
                       </div>

                       <div className="space-y-2">
                          <Label className="text-xs font-medium">Walk-Forward Plan</Label>
                          <div className="space-y-1.5 bg-white rounded-md border p-3">
                             {folds.map((fold, i) => (
                                <div key={i} className="flex items-center gap-2">
                                   <span className="text-[9px] text-muted-foreground w-10 shrink-0 text-right">
                                      {backtestEnabled ? `Fold ${i + 1}` : ''}
                                   </span>
                                   <div className="flex-1 flex h-5 rounded overflow-hidden bg-slate-100">
                                      {fold.train > 0 && (
                                         <div
                                            className="bg-emerald-400 h-full"
                                            style={{ width: `${(fold.train / maxTotal) * 100}%` }}
                                            title={`Train: ${fold.train} ${freqUnit}`}
                                         />
                                      )}
                                      {fold.gap > 0 && (
                                         <div
                                            className="bg-slate-200 h-full"
                                            style={{ width: `${(fold.gap / maxTotal) * 100}%` }}
                                            title={`Gap: ${fold.gap} ${freqUnit}`}
                                         />
                                      )}
                                      {fold.test > 0 && (
                                         <div
                                            className="bg-amber-400 h-full"
                                            style={{ width: `${(fold.test / maxTotal) * 100}%` }}
                                            title={`Backtest: ${fold.test} ${freqUnit}`}
                                         />
                                      )}
                                      {fold.inference > 0 && (
                                         <div
                                            className="bg-blue-400 h-full"
                                            style={{ width: `${(fold.inference / maxTotal) * 100}%` }}
                                            title={`Inference: ${fold.inference} ${freqUnit}`}
                                         />
                                      )}
                                   </div>
                                </div>
                             ))}
                          </div>
                          <div className="flex items-center gap-3 text-[9px] text-muted-foreground pt-1">
                             <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Training</div>
                             <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Backtesting</div>
                             <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-blue-400" /> Inference</div>
                          </div>
                       </div>
                         </div>
                       </details>

                       {/* --- Inline Advanced Settings Sections --- */}
                       {(() => {
                         const QUANTILES_ALL = [
                           { value: "0.01", label: "P1" }, { value: "0.05", label: "P5" },
                           { value: "0.1", label: "P10" }, { value: "0.2", label: "P20" },
                           { value: "0.25", label: "P25" }, { value: "0.5", label: "P50" },
                           { value: "0.75", label: "P75" }, { value: "0.8", label: "P80" },
                           { value: "0.9", label: "P90" }, { value: "0.95", label: "P95" },
                           { value: "0.99", label: "P99" },
                         ];
                         const toggleInArray = (arr: string[], val: string) => arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

                         return (
                           <div className="space-y-2 pt-1" data-testid="advanced-config-sections">
                             <details className="group border rounded-lg">
                               <summary className="flex items-center justify-between p-3 cursor-pointer text-xs font-semibold hover:bg-muted/50">
                                 Model Specs
                                 <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                               </summary>
                               <div className="px-3 pb-3 space-y-3">
                                 <div className="space-y-1">
                                   <Label className="text-xs">Evaluation Metric</Label>
                                   <Select value={cfgEvalMetric} onValueChange={setCfgEvalMetric}>
                                     <SelectTrigger className="h-8 text-xs" data-testid="select-eval-metric"><SelectValue /></SelectTrigger>
                                     <SelectContent>
                                       <SelectItem value="MASE">MASE — Mean Absolute Scaled Error</SelectItem>
                                       <SelectItem value="MAPE">MAPE — Mean Absolute Percentage Error</SelectItem>
                                       <SelectItem value="RMSE">RMSE — Root Mean Square Error</SelectItem>
                                       <SelectItem value="WQL">WQL — Weighted Quantile Loss</SelectItem>
                                     </SelectContent>
                                   </Select>
                                 </div>
                                 {/* Confidence Interval Presets */}
                                 <div className="space-y-2">
                                   <Label className="text-xs">Prediction Interval</Label>
                                   <div className="grid grid-cols-2 gap-1.5" data-testid="ci-preset-buttons">
                                     {Object.entries(CI_PRESETS).map(([key, ci]) => (
                                       <button
                                         key={key}
                                         onClick={() => {
                                           setCfgCIPreset(key as any);
                                           if (key !== 'custom') setCfgQuantiles(ci.quantiles);
                                         }}
                                         className={`text-left p-2 rounded-md border text-[10px] transition-all ${cfgCIPreset === key ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-muted hover:border-violet-300 bg-white'}`}
                                         data-testid={`ci-preset-${key}`}
                                       >
                                         <div className="font-semibold">{ci.label}</div>
                                         <div className="text-muted-foreground leading-tight mt-0.5">{ci.desc}</div>
                                       </button>
                                     ))}
                                   </div>
                                   {cfgCIPreset === 'custom' && (
                                     <div className="border rounded-md max-h-32 overflow-y-auto p-1.5 space-y-0.5 mt-1">
                                       {QUANTILES_ALL.map(q => (
                                         <label key={q.value} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-muted/30 rounded px-1 py-0.5">
                                           <Checkbox checked={cfgQuantiles.includes(q.value)} onCheckedChange={() => setCfgQuantiles(prev => toggleInArray(prev, q.value))} className="h-3.5 w-3.5" />
                                           {q.label}
                                         </label>
                                       ))}
                                     </div>
                                   )}
                                   {cfgCIPreset !== 'custom' && (
                                     <p className="text-[10px] text-muted-foreground">Quantiles: {cfgQuantiles.join(', ')}</p>
                                   )}
                                 </div>
                                 <Separator />
                                 {/* Visual preset cards */}
                                 <div className="space-y-1.5">
                                   <Label className="text-xs">Training Preset</Label>
                                   <div className="grid grid-cols-2 gap-1.5" data-testid="preset-cards">
                                     {PRESET_CARDS.map(p => (
                                       <button
                                         key={p.value}
                                         onClick={() => { setCfgPreset(p.value); setCfgSelectedModels(getModelsForPreset(p.value)); }}
                                         className={`text-left p-2 rounded-md border transition-all ${cfgPreset === p.value ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-muted hover:border-violet-300 bg-white'}`}
                                         data-testid={`preset-card-${p.value}`}
                                       >
                                         <div className="text-[11px] font-semibold">{p.label}</div>
                                         <div className="text-[9px] text-muted-foreground font-mono">{p.time}</div>
                                         <div className="text-[9px] text-slate-500">{p.quality}</div>
                                       </button>
                                     ))}
                                   </div>
                                 </div>
                                 <div className="space-y-1">
                                   <Label className="text-xs">Time Limit (seconds)</Label>
                                   <Input type="number" value={cfgTimeLimit} onChange={e => setCfgTimeLimit(e.target.value)} className="h-8 text-xs" data-testid="input-time-limit" />
                                 </div>
                                 <div className="flex items-center justify-between py-1">
                                   <Label className="text-xs">Refit Full</Label>
                                   <Switch checked={cfgRefitFull} onCheckedChange={setCfgRefitFull} data-testid="switch-refit-full" />
                                 </div>
                               </div>
                             </details>

                             <details className="group border rounded-lg">
                               <summary className="flex items-center justify-between p-3 cursor-pointer text-xs font-semibold hover:bg-muted/50">
                                 Models
                                 <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                               </summary>
                               <div className="px-3 pb-3 space-y-3">
                                 <div className="space-y-2">
                                   <Label className="text-xs">Model Selection</Label>
                                   <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-2">
                                     {["Statistical", "Deep Learning", "Tree-Based", "Foundation", "Ensemble"].map(category => (
                                       <div key={category} className="space-y-1">
                                         <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{category}</h5>
                                         {Object.entries(ALL_MODELS).filter(([_, m]) => m.category === category).map(([key, model]) => (
                                           <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-muted/30 rounded px-1 py-0.5">
                                             <Checkbox
                                               checked={cfgSelectedModels[key] || false}
                                               onCheckedChange={() => setCfgSelectedModels(prev => ({ ...prev, [key]: !prev[key] }))}
                                               className="h-3.5 w-3.5"
                                             />
                                             {model.label}
                                           </label>
                                         ))}
                                       </div>
                                     ))}
                                   </div>
                                 </div>

                                 {Object.values(cfgSelectedModels).every(v => !v) && (
                                   <p className="text-xs text-muted-foreground italic text-center py-2">No models selected</p>
                                 )}
                               </div>
                             </details>

                             <details className="group border rounded-lg">
                               <summary className="flex items-center justify-between p-3 cursor-pointer text-xs font-semibold hover:bg-muted/50">
                                 Feature Engineering
                                 <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                               </summary>
                               <div className="px-3 pb-3 space-y-3">
                                 <div className="space-y-1">
                                   <Label className="text-xs font-semibold">Dataset Schema</Label>
                                   <p className="text-[10px] text-muted-foreground">Map your dataset columns to AutoGluon's expected inputs.</p>
                                 </div>
                                 <div className="space-y-1">
                                   <Label className="text-xs">Target Variable</Label>
                                   <select value={cfgTargetVar} onChange={e => setCfgTargetVar(e.target.value)} className="w-full h-8 text-xs rounded-md border border-input bg-background px-3 ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" data-testid="select-target-var">
                                     <option value="">Select column...</option>
                                     {getNodeColumns(selectedNode.id).map(col => (
                                       <option key={col} value={col}>{col}</option>
                                     ))}
                                   </select>
                                 </div>
                                 <div className="space-y-1">
                                   <Label className="text-xs">Timestamp Column</Label>
                                   <select value={cfgTimeCol} onChange={e => setCfgTimeCol(e.target.value)} className="w-full h-8 text-xs rounded-md border border-input bg-background px-3 ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" data-testid="select-time-col">
                                     <option value="">Select column...</option>
                                     {getNodeColumns(selectedNode.id).map(col => (
                                       <option key={col} value={col}>{col}</option>
                                     ))}
                                   </select>
                                 </div>
                                 <div className="space-y-1">
                                   <Label className="text-xs">Item ID (DFU)</Label>
                                   <select value={cfgDfu} onChange={e => setCfgDfu(e.target.value)} className="w-full h-8 text-xs rounded-md border border-input bg-background px-3 ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" data-testid="select-dfu">
                                     <option value="">Select column...</option>
                                     {getNodeColumns(selectedNode.id).map(col => (
                                       <option key={col} value={col}>{col}</option>
                                     ))}
                                   </select>
                                 </div>

                                 <Separator />

                                 <div className="space-y-1">
                                   <Label className="text-xs font-semibold">Static Features</Label>
                                   <p className="text-[10px] text-muted-foreground">Columns that don't change over time per item (e.g., category, region).</p>
                                   <div className="border rounded-md max-h-28 overflow-y-auto p-1.5 space-y-0.5">
                                     {getNodeColumns(selectedNode.id).filter(c => c !== cfgTargetVar && c !== cfgTimeCol && c !== cfgDfu).map(col => (
                                       <label key={col} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-muted/30 rounded px-1 py-0.5">
                                         <Checkbox checked={cfgStaticFeatures.includes(col)} onCheckedChange={() => setCfgStaticFeatures(prev => prev.includes(col) ? prev.filter(v => v !== col) : [...prev, col])} className="h-3.5 w-3.5" />
                                         {col}
                                       </label>
                                     ))}
                                   </div>
                                 </div>

                                 <div className="space-y-1">
                                   <Label className="text-xs font-semibold">Known Covariates</Label>
                                   <p className="text-[10px] text-muted-foreground">Columns whose future values are known (e.g., promotions, price).</p>
                                   <div className="border rounded-md max-h-28 overflow-y-auto p-1.5 space-y-0.5">
                                     {getNodeColumns(selectedNode.id).filter(c => c !== cfgTargetVar && c !== cfgTimeCol && c !== cfgDfu).map(col => (
                                       <label key={col} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-muted/30 rounded px-1 py-0.5">
                                         <Checkbox checked={cfgKnownCovariates.includes(col)} onCheckedChange={() => setCfgKnownCovariates(prev => prev.includes(col) ? prev.filter(v => v !== col) : [...prev, col])} className="h-3.5 w-3.5" />
                                         {col}
                                       </label>
                                     ))}
                                   </div>
                                 </div>

                                 <Separator />

                                 <div className="space-y-2">
                                   <div className="flex items-center justify-between">
                                     <Label className="text-xs font-semibold">Holiday Features</Label>
                                     <Switch checked={cfgHolidayEnabled} onCheckedChange={setCfgHolidayEnabled} data-testid="switch-holidays" />
                                   </div>
                                   {cfgHolidayEnabled && (
                                     <div className="space-y-1">
                                       <Label className="text-[10px] text-muted-foreground">Country</Label>
                                       <Select value={cfgHolidayCountry} onValueChange={setCfgHolidayCountry}>
                                         <SelectTrigger className="h-8 text-xs" data-testid="select-holiday-country"><SelectValue /></SelectTrigger>
                                         <SelectContent>
                                           <SelectItem value="US">United States</SelectItem>
                                           <SelectItem value="GB">United Kingdom</SelectItem>
                                           <SelectItem value="DE">Germany</SelectItem>
                                           <SelectItem value="FR">France</SelectItem>
                                           <SelectItem value="JP">Japan</SelectItem>
                                           <SelectItem value="CN">China</SelectItem>
                                           <SelectItem value="IN">India</SelectItem>
                                           <SelectItem value="BR">Brazil</SelectItem>
                                           <SelectItem value="CA">Canada</SelectItem>
                                           <SelectItem value="AU">Australia</SelectItem>
                                         </SelectContent>
                                       </Select>
                                     </div>
                                   )}
                                 </div>
                               </div>
                             </details>

                             <details className="group border rounded-lg">
                               <summary className="flex items-center justify-between p-3 cursor-pointer text-xs font-semibold hover:bg-muted/50">
                                 Data Preprocessing
                                 <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                               </summary>
                               <div className="px-3 pb-3 space-y-3">
                                 <div className="text-[10px] text-muted-foreground bg-blue-50 p-2 rounded border border-blue-100">
                                   These transforms are applied within each train/test fold to prevent data leakage. Unlike pipeline-level transforms, they only use training data statistics.
                                 </div>

                                 <div className="space-y-2">
                                   <div className="flex items-center justify-between">
                                     <Label className="text-xs font-semibold">Fill Missing Values</Label>
                                     <Switch checked={cfgFillMissing} onCheckedChange={setCfgFillMissing} data-testid="switch-fill-missing" />
                                   </div>
                                   {cfgFillMissing && (
                                     <div className="space-y-1">
                                       {getNodeColumns(selectedNode.id).filter(c => c !== cfgTimeCol && c !== cfgDfu).length === 0 ? (
                                         <p className="text-[10px] text-muted-foreground px-1 py-2">Connect a data source first</p>
                                       ) : (
                                         <table className="w-full text-xs">
                                           <thead>
                                             <tr className="bg-muted/30">
                                               <th className="w-6 p-1"></th>
                                               <th className="text-left p-1 font-medium">Column</th>
                                               <th className="text-left p-1 font-medium">Strategy</th>
                                             </tr>
                                           </thead>
                                           <tbody>
                                             {getNodeColumns(selectedNode.id).filter(c => c !== cfgTimeCol && c !== cfgDfu).map(col => (
                                               <React.Fragment key={col}>
                                                 <tr className="hover:bg-muted/20 border-b">
                                                   <td className="p-1 text-center">
                                                     <Checkbox
                                                       checked={!!cfgFillConfigs[col]}
                                                       onCheckedChange={(checked) => {
                                                         setCfgFillConfigs(prev => {
                                                           if (checked) {
                                                             return { ...prev, [col]: { strategy: 'ffill', constant: '' } };
                                                           } else {
                                                             const next = { ...prev };
                                                             delete next[col];
                                                             return next;
                                                           }
                                                         });
                                                       }}
                                                       className="h-3.5 w-3.5"
                                                       data-testid={`checkbox-fill-${col}`}
                                                     />
                                                   </td>
                                                   <td className="p-1 font-mono text-[11px]">{col}</td>
                                                   <td className="p-1">
                                                     <select
                                                       value={cfgFillConfigs[col]?.strategy || 'ffill'}
                                                       onChange={e => {
                                                         setCfgFillConfigs(prev => ({
                                                           ...prev,
                                                           [col]: { ...prev[col], strategy: e.target.value }
                                                         }));
                                                       }}
                                                       disabled={!cfgFillConfigs[col]}
                                                       className="w-full h-6 text-[11px] rounded-md border border-input bg-background px-1 disabled:opacity-50"
                                                       data-testid={`select-fill-strategy-${col}`}
                                                     >
                                                       <option value="ffill">Forward Fill</option>
                                                       <option value="bfill">Backward Fill</option>
                                                       <option value="interpolate">Interpolation</option>
                                                       <option value="mean">Mean</option>
                                                       <option value="median">Median</option>
                                                       <option value="zero">Zero</option>
                                                       <option value="constant">Constant</option>
                                                     </select>
                                                   </td>
                                                 </tr>
                                                 {cfgFillConfigs[col]?.strategy === 'constant' && (
                                                   <tr className="border-b">
                                                     <td></td>
                                                     <td colSpan={2} className="p-1">
                                                       <Input
                                                         value={cfgFillConfigs[col]?.constant || ''}
                                                         onChange={e => {
                                                           setCfgFillConfigs(prev => ({
                                                             ...prev,
                                                             [col]: { ...prev[col], constant: e.target.value }
                                                           }));
                                                         }}
                                                         className="h-6 text-[11px]"
                                                         placeholder="Constant value..."
                                                         data-testid={`input-fill-constant-${col}`}
                                                       />
                                                     </td>
                                                   </tr>
                                                 )}
                                               </React.Fragment>
                                             ))}
                                           </tbody>
                                         </table>
                                       )}
                                     </div>
                                   )}
                                 </div>

                                 <Separator />

                                 <div className="space-y-2">
                                   <div className="flex items-center justify-between">
                                     <Label className="text-xs font-semibold">Outlier Treatment</Label>
                                     <Switch checked={cfgOutlierTreatment} onCheckedChange={setCfgOutlierTreatment} data-testid="switch-outlier" />
                                   </div>
                                   {cfgOutlierTreatment && (
                                     <div className="space-y-1">
                                       {getNodeColumns(selectedNode.id).filter(c => c !== cfgTimeCol && c !== cfgDfu).length === 0 ? (
                                         <p className="text-[10px] text-muted-foreground px-1 py-2">Connect a data source first</p>
                                       ) : (
                                         <table className="w-full text-xs">
                                           <thead>
                                             <tr className="bg-muted/30">
                                               <th className="w-6 p-1"></th>
                                               <th className="text-left p-1 font-medium">Column</th>
                                               <th className="text-left p-1 font-medium">Method</th>
                                               <th className="text-left p-1 font-medium">Threshold</th>
                                               <th className="text-left p-1 font-medium">Action</th>
                                             </tr>
                                           </thead>
                                           <tbody>
                                             {getNodeColumns(selectedNode.id).filter(c => c !== cfgTimeCol && c !== cfgDfu).map(col => (
                                               <tr key={col} className="hover:bg-muted/20 border-b">
                                                 <td className="p-1 text-center">
                                                   <Checkbox
                                                     checked={!!cfgOutlierConfigs[col]}
                                                     onCheckedChange={(checked) => {
                                                       setCfgOutlierConfigs(prev => {
                                                         if (checked) {
                                                           return { ...prev, [col]: { method: 'iqr', threshold: '1.5', action: 'cap' } };
                                                         } else {
                                                           const next = { ...prev };
                                                           delete next[col];
                                                           return next;
                                                         }
                                                       });
                                                     }}
                                                     className="h-3.5 w-3.5"
                                                     data-testid={`checkbox-outlier-${col}`}
                                                   />
                                                 </td>
                                                 <td className="p-1 font-mono text-[11px]">{col}</td>
                                                 <td className="p-1">
                                                   <select
                                                     value={cfgOutlierConfigs[col]?.method || 'iqr'}
                                                     onChange={e => {
                                                       const method = e.target.value;
                                                       const threshold = method === 'iqr' ? '1.5' : method === 'zscore' ? '3.0' : '0.01';
                                                       setCfgOutlierConfigs(prev => ({
                                                         ...prev,
                                                         [col]: { ...prev[col], method, threshold }
                                                       }));
                                                     }}
                                                     disabled={!cfgOutlierConfigs[col]}
                                                     className="w-full h-6 text-[11px] rounded-md border border-input bg-background px-1 disabled:opacity-50"
                                                     data-testid={`select-outlier-method-${col}`}
                                                   >
                                                     <option value="iqr">IQR</option>
                                                     <option value="zscore">Z-Score</option>
                                                     <option value="percentile">Percentile</option>
                                                   </select>
                                                 </td>
                                                 <td className="p-1">
                                                   <Input
                                                     value={cfgOutlierConfigs[col]?.threshold || ''}
                                                     onChange={e => {
                                                       setCfgOutlierConfigs(prev => ({
                                                         ...prev,
                                                         [col]: { ...prev[col], threshold: e.target.value }
                                                       }));
                                                     }}
                                                     disabled={!cfgOutlierConfigs[col]}
                                                     className="h-6 text-[11px] w-16"
                                                     data-testid={`input-outlier-threshold-${col}`}
                                                   />
                                                 </td>
                                                 <td className="p-1">
                                                   <select
                                                     value={cfgOutlierConfigs[col]?.action || 'cap'}
                                                     onChange={e => {
                                                       setCfgOutlierConfigs(prev => ({
                                                         ...prev,
                                                         [col]: { ...prev[col], action: e.target.value }
                                                       }));
                                                     }}
                                                     disabled={!cfgOutlierConfigs[col]}
                                                     className="w-full h-6 text-[11px] rounded-md border border-input bg-background px-1 disabled:opacity-50"
                                                     data-testid={`select-outlier-action-${col}`}
                                                   >
                                                     <option value="cap">Cap/Floor</option>
                                                     <option value="median">Median</option>
                                                     <option value="mean">Mean</option>
                                                     <option value="null">Null</option>
                                                     <option value="remove">Remove</option>
                                                   </select>
                                                 </td>
                                               </tr>
                                             ))}
                                           </tbody>
                                         </table>
                                       )}
                                       <div className="text-[10px] text-blue-700 bg-blue-50 p-2 rounded border border-blue-100">
                                         Outlier detection uses only training data statistics to avoid leakage. Test data is treated using thresholds computed from the training fold.
                                       </div>
                                     </div>
                                   )}
                                 </div>
                               </div>
                             </details>

                             <details className="group border rounded-lg">
                               <summary className="flex items-center justify-between p-3 cursor-pointer text-xs font-semibold hover:bg-muted/50">
                                 System
                                 <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                               </summary>
                               <div className="px-3 pb-3 space-y-3">
                                 <div className="space-y-1">
                                   <Label className="text-xs">Number of CPUs</Label>
                                   <Select value={cfgCpus} onValueChange={setCfgCpus}>
                                     <SelectTrigger className="h-8 text-xs" data-testid="select-cpus"><SelectValue /></SelectTrigger>
                                     <SelectContent>
                                       <SelectItem value="auto">Auto (Detect)</SelectItem>
                                       <SelectItem value="2">2 Cores</SelectItem>
                                       <SelectItem value="4">4 Cores</SelectItem>
                                       <SelectItem value="8">8 Cores</SelectItem>
                                     </SelectContent>
                                   </Select>
                                 </div>
                                 <div className="space-y-1">
                                   <Label className="text-xs">Logging Level</Label>
                                   <Select value={cfgLogLevel} onValueChange={setCfgLogLevel}>
                                     <SelectTrigger className="h-8 text-xs" data-testid="select-log-level"><SelectValue /></SelectTrigger>
                                     <SelectContent>
                                       <SelectItem value="error">Error Only</SelectItem>
                                       <SelectItem value="info">Info (Standard)</SelectItem>
                                       <SelectItem value="debug">Debug (Verbose)</SelectItem>
                                     </SelectContent>
                                   </Select>
                                 </div>
                               </div>
                             </details>
                           </div>
                         );
                       })()}

                       {/* ── Model Leaderboard (shown after execution) ── */}
                       {(() => {
                         // AutoGluon leaderboard columns: model, score_val, pred_time_val, fit_time_marginal, fit_order
                         const lb: Array<{model?: string; score_val?: number; fit_time_marginal?: number}> = selectedNode.data.resultInfo?.leaderboard || [];
                         if (!lb.length) return null;
                         // AutoGluon already returns rows sorted best-first (descending score_val)
                         // score_val is negated for error metrics (higher is better internally)
                         const sorted = [...lb].sort((a, b) => (b.score_val ?? -Infinity) - (a.score_val ?? -Infinity));
                         return (
                           <div className="border rounded-lg overflow-hidden mt-2" data-testid="model-leaderboard">
                             <div className="bg-violet-50 px-3 py-1.5 text-[10px] font-semibold text-violet-700 uppercase tracking-wide flex items-center gap-1.5">
                               <Cpu className="w-3 h-3" /> Model Leaderboard
                             </div>
                             {sorted.slice(0, 8).map((row, i) => (
                               <div key={i} className={`flex items-center gap-2 px-3 py-1.5 text-[11px] border-t ${i === 0 ? 'bg-violet-50/60 font-semibold' : 'hover:bg-muted/30'}`}>
                                 <span className={`w-4 text-center text-[9px] font-bold ${i === 0 ? 'text-violet-600' : 'text-muted-foreground'}`}>{i + 1}</span>
                                 <span className="flex-1 truncate font-mono text-[10px]">{row.model || 'Unknown'}</span>
                                 <span className={`text-[10px] font-mono ${i === 0 ? 'text-violet-700' : 'text-slate-600'}`} title="AutoGluon internal CV score (higher = better)">
                                   {typeof row.score_val === 'number' ? row.score_val.toFixed(4) : '—'}
                                 </span>
                                 {typeof row.fit_time_marginal === 'number' && (
                                   <span className="text-[9px] text-muted-foreground w-10 text-right">{row.fit_time_marginal.toFixed(1)}s</span>
                                 )}
                                 {i === 0 && <span className="text-[9px] bg-violet-200 text-violet-700 px-1 rounded shrink-0">Best</span>}
                               </div>
                             ))}
                           </div>
                         );
                       })()}
                    </div>
                    );
                  })()}

                  {selectedNode.data.type === 'output' && (() => {
                    // Find upstream model_config node for its resultInfo
                    const upEdge = edgesRef.current.find(e => e.target === selectedNode.id);
                    const modelNode = upEdge ? nodesRef.current.find(n => n.id === upEdge.source && (n.data.type === 'config' || n.data.type === 'model_config')) : null;
                    const ri = modelNode?.data?.resultInfo || selectedNode.data.resultInfo;
                    const hasMape = typeof ri?.mape === 'number';
                    const hasRmse = typeof ri?.rmse === 'number';
                    const hasMae  = typeof ri?.mae  === 'number';
                    const hasAgScore = typeof ri?.ag_score_val === 'number';
                    const agEvalMetric: string = ri?.ag_eval_metric || 'Score';
                    const hasMetrics = hasMape || hasRmse || hasMae || hasAgScore;
                    const forecastRows = ri?.forecast_rows ?? 0;
                    const forecastData = modelNode?.data?.resultInfo?.forecast || null;

                    const downloadForecast = () => {
                      if (!forecastData || !forecastData.length) { toast.error('No forecast data — run the pipeline first'); return; }
                      const headers = Object.keys(forecastData[0]);
                      const csv = [headers.join(','), ...forecastData.map((r: any) => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = 'forecast.csv'; a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Forecast downloaded');
                    };

                    return (
                    <div className="space-y-3 border rounded-md p-4 bg-green-50/50 border-green-100">
                       {hasMetrics && (
                         <div className="space-y-1.5">
                           <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">
                             {(hasMape || hasRmse || hasMae) ? 'Holdout Backtest Accuracy' : 'Model Validation Score'}
                           </p>
                           <div className="grid grid-cols-3 gap-1.5" data-testid="output-metrics-card">
                             {hasMape && (
                               <div className="bg-white rounded-md p-2 border border-green-100 text-center">
                                 <p className="text-[10px] text-muted-foreground">MAPE</p>
                                 <p className="text-sm font-bold text-green-700">{ri.mape.toFixed(1)}%</p>
                               </div>
                             )}
                             {hasRmse && (
                               <div className="bg-white rounded-md p-2 border border-green-100 text-center">
                                 <p className="text-[10px] text-muted-foreground">RMSE</p>
                                 <p className="text-sm font-bold text-green-700">{ri.rmse.toFixed(2)}</p>
                               </div>
                             )}
                             {hasMae && (
                               <div className="bg-white rounded-md p-2 border border-green-100 text-center">
                                 <p className="text-[10px] text-muted-foreground">MAE</p>
                                 <p className="text-sm font-bold text-green-700">{ri.mae.toFixed(2)}</p>
                               </div>
                             )}
                             {hasAgScore && !hasMape && !hasRmse && !hasMae && (
                               <div className="bg-white rounded-md p-2 border border-green-100 text-center col-span-3">
                                 <p className="text-[10px] text-muted-foreground">{agEvalMetric} (AutoGluon CV)</p>
                                 <p className="text-sm font-bold text-green-700">{Math.abs(ri.ag_score_val).toFixed(4)}</p>
                                 <p className="text-[9px] text-muted-foreground mt-0.5">Enable Backtest to compute MAPE/RMSE/MAE</p>
                               </div>
                             )}
                           </div>
                         </div>
                       )}
                       {forecastRows > 0 && (
                         <div className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-green-100">
                           <div>
                             <p className="text-xs font-medium text-green-800">Forecast Ready</p>
                             <p className="text-[10px] text-green-600">{forecastRows.toLocaleString()} forecast rows generated</p>
                           </div>
                           <CheckCircle2 className="w-5 h-5 text-green-500" />
                         </div>
                       )}
                       {/* Per-series accuracy breakdown */}
                       {(() => {
                         const perSeries: Array<Record<string, any>> = ri?.per_series_metrics || [];
                         if (!perSeries.length) return null;
                         const idKey = Object.keys(perSeries[0]).find(k => !['n','mape','rmse','mae'].includes(k)) || 'series';
                         return (
                           <details className="group border rounded-lg overflow-hidden">
                             <summary className="flex items-center justify-between px-3 py-2 cursor-pointer text-[10px] font-semibold text-green-700 bg-green-50 hover:bg-green-100">
                               Per-Series Accuracy
                               <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                             </summary>
                             <ScrollArea className="max-h-40">
                               <div className="text-[10px]">
                                 <div className="flex gap-1 bg-slate-50 px-2 py-1 font-semibold text-slate-500 border-b">
                                   <span className="flex-1 truncate">{idKey}</span>
                                   <span className="w-10 text-right">MAPE%</span>
                                   <span className="w-10 text-right">RMSE</span>
                                 </div>
                                 {perSeries.slice(0, 20).map((row, i) => (
                                   <div key={i} className="flex gap-1 px-2 py-1 border-b hover:bg-muted/20">
                                     <span className="flex-1 truncate font-mono" title={String(row[idKey])}>{row[idKey]}</span>
                                     <span className={`w-10 text-right font-mono ${(row.mape ?? 100) > 20 ? 'text-orange-600 font-semibold' : 'text-slate-600'}`}>
                                       {typeof row.mape === 'number' ? row.mape.toFixed(1) : '—'}
                                     </span>
                                     <span className="w-10 text-right font-mono text-slate-600">{typeof row.rmse === 'number' ? row.rmse.toFixed(1) : '—'}</span>
                                   </div>
                                 ))}
                               </div>
                             </ScrollArea>
                           </details>
                         );
                       })()}
                       <div className="flex flex-col items-center justify-center text-center space-y-2 py-1">
                          <div className="bg-green-100 p-3 rounded-full">
                             <Activity className="w-6 h-6 text-green-600" />
                          </div>
                          <div>
                             <h4 className="text-sm font-semibold text-green-900">Forecast Output & Analysis</h4>
                             <p className="text-xs text-green-700 mt-1">Compare actual vs predicted, view pattern classification, and explore results.</p>
                          </div>
                          <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => {
                            setResultsOpen(true);
                            setResultsModelInfo({
                              forecast: modelNode?.data?.resultInfo?.forecast ?? ri?.forecast,
                              backtest: modelNode?.data?.resultInfo?.backtest ?? ri?.backtest,
                              leaderboard: ri?.leaderboard,
                              per_series_metrics: ri?.per_series_metrics,
                              mape: ri?.mape,
                              rmse: ri?.rmse,
                              mae: ri?.mae,
                              forecast_rows: ri?.forecast_rows,
                              target: modelNode?.data?.cfgTargetVar,
                              horizon: modelNode?.data?.forecastHorizon ? parseInt(modelNode.data.forecastHorizon) : undefined,
                              preset: modelNode?.data?.cfgPreset,
                            });
                          }} data-testid="button-view-results">
                             View Results & Analysis
                          </Button>
                          <Button variant="outline" className="w-full border-green-300 text-green-700 hover:bg-green-50" onClick={downloadForecast} data-testid="button-download-forecast">
                             <Download className="w-3.5 h-3.5 mr-1.5" /> Export Forecast CSV
                          </Button>
                       </div>
                    </div>
                    );
                  })()}

                  {selectedNode.data.type === 'merge' && (
                    <div className="space-y-4 border rounded-md p-3 bg-muted/20">
                      <div className="space-y-2">
                        <Label>Join Type</Label>
                        <Select 
                           value={selectedNode.data.joinType || 'inner'} 
                           onValueChange={(val) => updateNodeData('joinType', val)}
                        >
                          <SelectTrigger className="h-8" data-testid="select-join-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inner">Inner Join</SelectItem>
                            <SelectItem value="left">Left Join</SelectItem>
                            <SelectItem value="right">Right Join</SelectItem>
                            <SelectItem value="outer">Full Outer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          Left Keys
                          <span className="text-[10px] text-muted-foreground font-normal">(Source 1)</span>
                        </Label>
                        <ColumnMultiSelect
                          label="Left Keys"
                          selectedCols={selectedNode.data.leftKeys || []}
                          availableCols={getSourceColumns(selectedNode.id, 0)}
                          onChange={(cols) => updateNodeData('leftKeys', cols)}
                          testId="select-left-keys"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          Right Keys
                          <span className="text-[10px] text-muted-foreground font-normal">(Source 2)</span>
                        </Label>
                        <ColumnMultiSelect
                          label="Right Keys"
                          selectedCols={selectedNode.data.rightKeys || []}
                          availableCols={getSourceColumns(selectedNode.id, 1)}
                          onChange={(cols) => updateNodeData('rightKeys', cols)}
                          testId="select-right-keys"
                        />
                      </div>
                    </div>
                  )}

                  {selectedNode.data.type === 'preview' && (
                    <div className="space-y-4 border rounded-md p-3 bg-muted/20">
                      <div className="space-y-2">
                        <Label className="flex items-center justify-between">
                          <span>Preview Rows</span>
                          <span className="text-[10px] text-muted-foreground">
                            {previewData ? `${previewData.rows.length} of ${previewData.totalRows} total` : 'Connect a data source'}
                          </span>
                        </Label>
                        <Select 
                          value={String(selectedNode.data.previewRows || 10)} 
                          onValueChange={(val) => updateNodeData('previewRows', parseInt(val))}
                        >
                          <SelectTrigger className="h-8" data-testid="select-preview-rows">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5 rows</SelectItem>
                            <SelectItem value="10">10 rows</SelectItem>
                            <SelectItem value="20">20 rows</SelectItem>
                            <SelectItem value="50">50 rows</SelectItem>
                            <SelectItem value="100">100 rows</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {previewLoading && (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          Loading preview...
                        </div>
                      )}
                      
                      {!previewLoading && previewData && previewData.columns.length > 0 && (
                        <div className="space-y-2">
                          <Label>Data Preview</Label>
                          <div className="border rounded-md overflow-auto max-h-64 bg-white">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/50 sticky top-0">
                                <tr>
                                  {previewData.columns.map((col) => (
                                    <th key={col} className="text-left font-medium p-2 border-b whitespace-nowrap">
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {previewData.rows.map((row, idx) => (
                                  <tr key={idx} className="hover:bg-muted/30">
                                    {previewData.columns.map((col) => (
                                      <td key={col} className="p-2 border-b font-mono whitespace-nowrap max-w-[200px] truncate">
                                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span className="text-muted-foreground italic">null</span>}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      
                      {!previewLoading && !previewData && (
                        <div className="text-center py-4 text-muted-foreground text-sm border rounded-md bg-muted/10">
                          Connect a data source to see preview
                        </div>
                      )}
                    </div>
                  )}

                  {selectedNode.data.type === 'filter' && (() => {
                    const sourceCols = getSourceColumns(selectedNode.id);
                    const conditions: Array<{column:string;op:string;value:string;values:string[];logic:'AND'|'OR'}> =
                      selectedNode.data.filterConditions?.length
                        ? selectedNode.data.filterConditions
                        : [{ column: selectedNode.data.filterColumn || '', op: selectedNode.data.filterOp || 'eq', value: selectedNode.data.filterValue || '', values: selectedNode.data.filterValues || [], logic: 'AND' }];
                    const updateCond = (idx: number, field: string, val: any) => {
                      const next = conditions.map((c, i) => i === idx ? { ...c, [field]: val } : c);
                      updateNodeData('filterConditions', next);
                    };
                    const addCond = () => updateNodeData('filterConditions', [...conditions, { column: '', op: 'eq', value: '', values: [], logic: 'AND' }]);
                    const removeCond = (idx: number) => updateNodeData('filterConditions', conditions.filter((_:any, i:number) => i !== idx));
                    const opOptions = [
                      { value: 'eq', label: 'Equals (=)' }, { value: 'neq', label: 'Not Equals (!=)' },
                      { value: 'gt', label: 'Greater than' }, { value: 'gte', label: 'Greater or Equal' },
                      { value: 'lt', label: 'Less than' }, { value: 'lte', label: 'Less or Equal' },
                      { value: 'contains', label: 'Contains' }, { value: 'not_contains', label: 'Does not contain' },
                      { value: 'starts_with', label: 'Starts with' }, { value: 'ends_with', label: 'Ends with' },
                      { value: 'isin', label: 'Is in list' }, { value: 'notin', label: 'Not in list' },
                      { value: 'isnull', label: 'Is null' }, { value: 'notnull', label: 'Is not null' },
                    ];
                    const needsValue = (op: string) => !['isnull','notnull'].includes(op);
                    const isMultiVal = (op: string) => ['isin','notin'].includes(op);
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-yellow-700 font-semibold flex items-center gap-1"><Filter className="w-3 h-3" /> Filter Conditions</Label>
                          <span className="text-[10px] text-muted-foreground">{conditions.length} condition{conditions.length !== 1 ? 's' : ''}</span>
                        </div>
                        {conditions.map((cond: any, idx: number) => (
                          <div key={idx}>
                            {idx > 0 && (
                              <div className="flex items-center gap-2 my-1.5">
                                <div className="flex-1 h-px bg-border" />
                                <div className="flex border rounded overflow-hidden text-[10px]">
                                  {(['AND','OR'] as const).map(l => (
                                    <button key={l} onClick={() => updateCond(idx, 'logic', l)}
                                      className={cn('px-2 py-0.5 font-semibold transition-colors', cond.logic === l ? 'bg-yellow-500 text-white' : 'bg-white text-slate-500 hover:bg-muted')}
                                      data-testid={`filter-logic-${idx}-${l}`}>{l}</button>
                                  ))}
                                </div>
                                <div className="flex-1 h-px bg-border" />
                              </div>
                            )}
                            <div className="border rounded-md p-2.5 space-y-2 bg-yellow-50/40" data-testid={`filter-condition-${idx}`}>
                              <div className="flex items-center gap-1">
                                <Select value={cond.column || ''} onValueChange={(v) => updateCond(idx, 'column', v)}>
                                  <SelectTrigger className="h-7 font-mono text-[11px] flex-1" data-testid={`filter-col-${idx}`}>
                                    <SelectValue placeholder="Column…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {sourceCols.length === 0
                                      ? <div className="px-2 py-1 text-xs text-muted-foreground">Connect data first</div>
                                      : sourceCols.map(c => <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                {conditions.length > 1 && (
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeCond(idx)}>
                                    <X className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                              <Select value={cond.op || 'eq'} onValueChange={(v) => updateCond(idx, 'op', v)}>
                                <SelectTrigger className="h-7 text-xs" data-testid={`filter-op-${idx}`}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {opOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              {needsValue(cond.op) && !isMultiVal(cond.op) && (
                                <Input
                                  placeholder="Value"
                                  className="h-7 text-xs"
                                  value={cond.value || ''}
                                  onChange={(e) => updateCond(idx, 'value', e.target.value)}
                                  data-testid={`filter-value-${idx}`}
                                />
                              )}
                              {isMultiVal(cond.op) && (
                                <Input
                                  placeholder="val1, val2, val3"
                                  className="h-7 text-xs"
                                  value={(cond.values || []).join(', ')}
                                  onChange={(e) => updateCond(idx, 'values', e.target.value.split(',').map((v: string) => v.trim()).filter((v: string) => v))}
                                  data-testid={`filter-values-${idx}`}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                        {conditions.length < 6 && (
                          <Button variant="outline" size="sm" className="w-full h-7 text-xs border-dashed text-yellow-700 border-yellow-300 hover:bg-yellow-50" onClick={addCond} data-testid="button-add-filter-condition">
                            <Plus className="w-3 h-3 mr-1" /> Add Condition
                          </Button>
                        )}
                      </div>
                    );
                  })()}

                  {selectedNode.data.type === 'sampling' && (
                    <div className="space-y-4 border rounded-md p-3 bg-muted/20">
                      <div className="space-y-2">
                        <Label>Group Column</Label>
                        <Select 
                           value={selectedNode.data.samplingColumn || ''} 
                           onValueChange={(val) => updateNodeData('samplingColumn', val)}
                        >
                          <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-sampling-column">
                            <SelectValue placeholder="Select group column..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getSourceColumns(selectedNode.id).length === 0 ? (
                              <div className="px-2 py-1.5 text-xs text-muted-foreground">Connect a data source first</div>
                            ) : (
                              getSourceColumns(selectedNode.id).map(col => (
                                <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">
                          Sample a percentage of unique groups (e.g. DFU, SKU) and include all rows for each sampled group
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex justify-between">
                          <span>Sample Percentage</span>
                          <span className="text-xs font-mono">{selectedNode.data.samplePercent || 100}%</span>
                        </Label>
                        <input
                          type="range"
                          min="5"
                          max="100"
                          step="5"
                          value={selectedNode.data.samplePercent || 100}
                          onChange={(e) => updateNodeData('samplePercent', parseInt(e.target.value))}
                          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                          data-testid="slider-sample-percent"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>5%</span>
                          <span>100%</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Random Seed</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 42"
                          className="h-8 text-xs font-mono"
                          value={selectedNode.data.samplingSeed || ''}
                          onChange={(e) => updateNodeData('samplingSeed', e.target.value ? parseInt(e.target.value) : null)}
                          data-testid="input-sampling-seed"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Set a seed for repeatable sampling. Same seed = same groups selected.
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedNode.data.type === 'fillMissing' && (
                    <div className="space-y-4 border rounded-md p-3 bg-yellow-50/50 border-yellow-100">
                      <div className="space-y-2">
                        <Label>Target Columns</Label>
                        <ColumnMultiSelect
                          label="Columns to fill"
                          selectedCols={selectedNode.data.fillColumns || []}
                          availableCols={getSourceColumns(selectedNode.id)}
                          onChange={(cols) => updateNodeData('fillColumns', cols)}
                          testId="select-fill-columns"
                        />
                        <p className="text-[10px] text-muted-foreground">Leave empty to apply to all numeric columns</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Fill Strategy</Label>
                        <Select
                          value={selectedNode.data.fillStrategy || 'ffill'}
                          onValueChange={(val) => updateNodeData('fillStrategy', val)}
                        >
                          <SelectTrigger className="h-8 text-xs" data-testid="select-fill-strategy">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ffill">Forward Fill</SelectItem>
                            <SelectItem value="bfill">Backward Fill</SelectItem>
                            <SelectItem value="interpolate">Linear Interpolation</SelectItem>
                            <SelectItem value="mean">Fill with Mean</SelectItem>
                            <SelectItem value="median">Fill with Median</SelectItem>
                            <SelectItem value="zero">Fill with Zero</SelectItem>
                            <SelectItem value="constant">Fill with Constant</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedNode.data.fillStrategy === 'constant' && (
                        <div className="space-y-2">
                          <Label>Constant Value</Label>
                          <Input
                            className="h-8 text-xs font-mono"
                            placeholder="e.g. 0, N/A, Unknown"
                            value={selectedNode.data.fillConstant || ''}
                            onChange={(e) => updateNodeData('fillConstant', e.target.value)}
                            data-testid="input-fill-constant"
                          />
                        </div>
                      )}
                      <div className="text-[10px] text-yellow-700 bg-yellow-100/50 p-2 rounded">
                        Replaces NaN/null values in selected columns using the chosen strategy.
                      </div>
                    </div>
                  )}

                  {selectedNode.data.type === 'dateGapFill' && (
                    <div className="space-y-4 border rounded-md p-3 bg-yellow-50/50 border-yellow-100">
                      <div className="space-y-2">
                        <Label>Date Column</Label>
                        <Select
                          value={selectedNode.data.dateColumn || ''}
                          onValueChange={(val) => updateNodeData('dateColumn', val)}
                        >
                          <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-date-gap-column">
                            <SelectValue placeholder="Select date column..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getSourceColumns(selectedNode.id).length === 0 ? (
                              <div className="px-2 py-1.5 text-xs text-muted-foreground">Connect a data source first</div>
                            ) : (
                              getSourceColumns(selectedNode.id).map(col => (
                                <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Frequency</Label>
                        <Select
                          value={selectedNode.data.dateFrequency || 'D'}
                          onValueChange={(val) => updateNodeData('dateFrequency', val)}
                        >
                          <SelectTrigger className="h-8 text-xs" data-testid="select-date-frequency">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="D">Daily</SelectItem>
                            <SelectItem value="W">Weekly</SelectItem>
                            <SelectItem value="MS">Monthly</SelectItem>
                            <SelectItem value="QS">Quarterly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Group Column (optional)</Label>
                        <Select
                          value={selectedNode.data.dateGroupColumn || '__none__'}
                          onValueChange={(val) => updateNodeData('dateGroupColumn', val === '__none__' ? '' : val)}
                        >
                          <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-date-group-column">
                            <SelectValue placeholder="No grouping" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No grouping</SelectItem>
                            {getSourceColumns(selectedNode.id).map(col => (
                              <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">Fill gaps per group (e.g., per SKU or product)</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Fill Strategy for New Rows</Label>
                        <Select
                          value={selectedNode.data.gapFillStrategy || 'zero'}
                          onValueChange={(val) => updateNodeData('gapFillStrategy', val)}
                        >
                          <SelectTrigger className="h-8 text-xs" data-testid="select-gap-fill-strategy">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="zero">Fill with Zero</SelectItem>
                            <SelectItem value="ffill">Forward Fill</SelectItem>
                            <SelectItem value="interpolate">Linear Interpolation</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="text-[10px] text-yellow-700 bg-yellow-100/50 p-2 rounded">
                        Inserts missing time periods to create a continuous date series. Essential for time series forecasting.
                      </div>
                    </div>
                  )}

                  {selectedNode.data.type === 'outlierTreatment' && (
                    <div className="space-y-4 border rounded-md p-3 bg-yellow-50/50 border-yellow-100">
                      <div className="space-y-2">
                        <Label>Target Column</Label>
                        <Select
                          value={selectedNode.data.outlierColumn || ''}
                          onValueChange={(val) => updateNodeData('outlierColumn', val)}
                        >
                          <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-outlier-column">
                            <SelectValue placeholder="Select column..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getSourceColumns(selectedNode.id).length === 0 ? (
                              <div className="px-2 py-1.5 text-xs text-muted-foreground">Connect a data source first</div>
                            ) : (
                              getSourceColumns(selectedNode.id).map(col => (
                                <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Detection Method</Label>
                        <Select
                          value={selectedNode.data.outlierMethod || 'iqr'}
                          onValueChange={(val) => updateNodeData('outlierMethod', val)}
                        >
                          <SelectTrigger className="h-8 text-xs" data-testid="select-outlier-method">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="iqr">IQR (Interquartile Range)</SelectItem>
                            <SelectItem value="zscore">Z-Score</SelectItem>
                            <SelectItem value="percentile">Percentile</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex justify-between">
                          <span>Threshold</span>
                          <span className="text-xs font-mono text-muted-foreground">
                            {selectedNode.data.outlierMethod === 'zscore' ? 'σ' : 
                             selectedNode.data.outlierMethod === 'percentile' ? '%' : '× IQR'}
                          </span>
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          className="h-8 text-xs font-mono"
                          placeholder={selectedNode.data.outlierMethod === 'zscore' ? 'e.g. 3' : 
                                       selectedNode.data.outlierMethod === 'percentile' ? 'e.g. 95' : 'e.g. 1.5'}
                          value={selectedNode.data.outlierThreshold || ''}
                          onChange={(e) => updateNodeData('outlierThreshold', e.target.value ? parseFloat(e.target.value) : null)}
                          data-testid="input-outlier-threshold"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Treatment Action</Label>
                        <Select
                          value={selectedNode.data.outlierAction || 'cap'}
                          onValueChange={(val) => updateNodeData('outlierAction', val)}
                        >
                          <SelectTrigger className="h-8 text-xs" data-testid="select-outlier-action">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cap">Cap / Floor (Winsorize)</SelectItem>
                            <SelectItem value="median">Replace with Median</SelectItem>
                            <SelectItem value="mean">Replace with Mean</SelectItem>
                            <SelectItem value="null">Replace with Null</SelectItem>
                            <SelectItem value="remove">Remove Rows</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="text-[10px] text-yellow-700 bg-yellow-100/50 p-2 rounded">
                        Detects outliers using the selected method and applies the chosen treatment to handle extreme values.
                      </div>
                    </div>
                  )}

                  {selectedNode.data.type === 'columnTransform' && (
                    <div className="space-y-4 border rounded-md p-3 bg-yellow-50/50 border-yellow-100">
                      <div className="space-y-2">
                        <Label>Operation</Label>
                        <Select
                          value={selectedNode.data.colOperation || 'rename'}
                          onValueChange={(val) => updateNodeData('colOperation', val)}
                        >
                          <SelectTrigger className="h-8 text-xs" data-testid="select-col-operation">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rename">Rename Column</SelectItem>
                            <SelectItem value="drop">Drop Columns</SelectItem>
                            <SelectItem value="cast">Type Cast</SelectItem>
                            <SelectItem value="calculate">Calculated Column</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedNode.data.colOperation === 'rename' && (
                        <>
                          <div className="space-y-2">
                            <Label>Column to Rename</Label>
                            <Select
                              value={selectedNode.data.renameFrom || ''}
                              onValueChange={(val) => updateNodeData('renameFrom', val)}
                            >
                              <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-rename-from">
                                <SelectValue placeholder="Select column..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getSourceColumns(selectedNode.id).map(col => (
                                  <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>New Name</Label>
                            <Input
                              className="h-8 text-xs font-mono"
                              placeholder="new_column_name"
                              value={selectedNode.data.renameTo || ''}
                              onChange={(e) => updateNodeData('renameTo', e.target.value)}
                              data-testid="input-rename-to"
                            />
                          </div>
                        </>
                      )}

                      {selectedNode.data.colOperation === 'drop' && (
                        <div className="space-y-2">
                          <Label>Columns to Drop</Label>
                          <ColumnMultiSelect
                            label="Drop columns"
                            selectedCols={selectedNode.data.dropColumns || []}
                            availableCols={getSourceColumns(selectedNode.id)}
                            onChange={(cols) => updateNodeData('dropColumns', cols)}
                            testId="select-drop-columns"
                          />
                        </div>
                      )}

                      {selectedNode.data.colOperation === 'cast' && (
                        <>
                          <div className="space-y-2">
                            <Label>Column</Label>
                            <Select
                              value={selectedNode.data.castColumn || ''}
                              onValueChange={(val) => updateNodeData('castColumn', val)}
                            >
                              <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-cast-column">
                                <SelectValue placeholder="Select column..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getSourceColumns(selectedNode.id).map(col => (
                                  <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Target Type</Label>
                            <Select
                              value={selectedNode.data.castType || 'numeric'}
                              onValueChange={(val) => updateNodeData('castType', val)}
                            >
                              <SelectTrigger className="h-8 text-xs" data-testid="select-cast-type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="numeric">Numeric (float)</SelectItem>
                                <SelectItem value="integer">Integer</SelectItem>
                                <SelectItem value="string">String / Text</SelectItem>
                                <SelectItem value="datetime">Date / DateTime</SelectItem>
                                <SelectItem value="boolean">Boolean</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      {selectedNode.data.colOperation === 'calculate' && (
                        <>
                          <div className="space-y-2">
                            <Label>New Column Name</Label>
                            <Input
                              className="h-8 text-xs font-mono"
                              placeholder="e.g. revenue"
                              value={selectedNode.data.calcColumnName || ''}
                              onChange={(e) => updateNodeData('calcColumnName', e.target.value)}
                              data-testid="input-calc-column-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Expression</Label>
                            <Input
                              className="h-8 text-xs font-mono"
                              placeholder="e.g. price * quantity"
                              value={selectedNode.data.calcExpression || ''}
                              onChange={(e) => updateNodeData('calcExpression', e.target.value)}
                              data-testid="input-calc-expression"
                            />
                            <p className="text-[10px] text-muted-foreground">
                              Use column names and operators: +, -, *, /
                            </p>
                          </div>
                        </>
                      )}

                      {(!selectedNode.data.colOperation || selectedNode.data.colOperation === 'rename') && (
                        <div className="text-[10px] text-yellow-700 bg-yellow-100/50 p-2 rounded">
                          Transform columns without writing code — rename, drop, change types, or create calculated fields.
                        </div>
                      )}
                    </div>
                  )}

                  {selectedNode.data.type === 'removeDuplicates' && (
                    <div className="space-y-4 border rounded-md p-3 bg-yellow-50/50 border-yellow-100">
                      <div className="space-y-2">
                        <Label>Dedup Key Columns</Label>
                        <ColumnMultiSelect
                          label="Key columns"
                          selectedCols={selectedNode.data.dedupColumns || []}
                          availableCols={getSourceColumns(selectedNode.id)}
                          onChange={(cols) => updateNodeData('dedupColumns', cols)}
                          testId="select-dedup-columns"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Leave empty to check all columns for duplicates
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Keep</Label>
                        <Select
                          value={selectedNode.data.dedupKeep || 'first'}
                          onValueChange={(val) => updateNodeData('dedupKeep', val)}
                        >
                          <SelectTrigger className="h-8 text-xs" data-testid="select-dedup-keep">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="first">Keep First Occurrence</SelectItem>
                            <SelectItem value="last">Keep Last Occurrence</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="text-[10px] text-yellow-700 bg-yellow-100/50 p-2 rounded">
                        Removes duplicate rows based on the selected key columns.
                      </div>
                    </div>
                  )}

                  {selectedNode.data.type === 'pivotUnpivot' && (
                    <div className="space-y-4 border rounded-md p-3 bg-yellow-50/50 border-yellow-100">
                      <div className="space-y-2">
                        <Label>Mode</Label>
                        <Select
                          value={selectedNode.data.pivotMode || 'pivot'}
                          onValueChange={(val) => updateNodeData('pivotMode', val)}
                        >
                          <SelectTrigger className="h-8 text-xs" data-testid="select-pivot-mode">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pivot">Pivot (Long → Wide)</SelectItem>
                            <SelectItem value="unpivot">Unpivot (Wide → Long)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedNode.data.pivotMode !== 'unpivot' && (
                        <>
                          <div className="space-y-2">
                            <Label>Index Column (Rows)</Label>
                            <Select
                              value={selectedNode.data.pivotIndex || ''}
                              onValueChange={(val) => updateNodeData('pivotIndex', val)}
                            >
                              <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-pivot-index">
                                <SelectValue placeholder="Select row identifier..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getSourceColumns(selectedNode.id).map(col => (
                                  <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Columns to Spread</Label>
                            <Select
                              value={selectedNode.data.pivotColumns || ''}
                              onValueChange={(val) => updateNodeData('pivotColumns', val)}
                            >
                              <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-pivot-columns">
                                <SelectValue placeholder="Column whose values become headers..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getSourceColumns(selectedNode.id).map(col => (
                                  <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Values</Label>
                            <Select
                              value={selectedNode.data.pivotValues || ''}
                              onValueChange={(val) => updateNodeData('pivotValues', val)}
                            >
                              <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-pivot-values">
                                <SelectValue placeholder="Values to populate cells..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getSourceColumns(selectedNode.id).map(col => (
                                  <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Aggregation</Label>
                            <Select
                              value={selectedNode.data.pivotAggFunc || 'sum'}
                              onValueChange={(val) => updateNodeData('pivotAggFunc', val)}
                            >
                              <SelectTrigger className="h-8 text-xs" data-testid="select-pivot-agg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sum">Sum</SelectItem>
                                <SelectItem value="mean">Mean</SelectItem>
                                <SelectItem value="count">Count</SelectItem>
                                <SelectItem value="first">First</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      {selectedNode.data.pivotMode === 'unpivot' && (
                        <>
                          <div className="space-y-2">
                            <Label>ID Columns (Keep as rows)</Label>
                            <ColumnMultiSelect
                              label="ID columns"
                              selectedCols={selectedNode.data.unpivotIdColumns || []}
                              availableCols={getSourceColumns(selectedNode.id)}
                              onChange={(cols) => updateNodeData('unpivotIdColumns', cols)}
                              testId="select-unpivot-id-columns"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Columns to Melt</Label>
                            <ColumnMultiSelect
                              label="Value columns"
                              selectedCols={selectedNode.data.unpivotValueColumns || []}
                              availableCols={getSourceColumns(selectedNode.id)}
                              onChange={(cols) => updateNodeData('unpivotValueColumns', cols)}
                              testId="select-unpivot-value-columns"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Variable Name</Label>
                            <Input
                              className="h-8 text-xs font-mono"
                              placeholder="e.g. metric"
                              value={selectedNode.data.unpivotVarName || ''}
                              onChange={(e) => updateNodeData('unpivotVarName', e.target.value)}
                              data-testid="input-unpivot-var-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Value Name</Label>
                            <Input
                              className="h-8 text-xs font-mono"
                              placeholder="e.g. value"
                              value={selectedNode.data.unpivotValName || ''}
                              onChange={(e) => updateNodeData('unpivotValName', e.target.value)}
                              data-testid="input-unpivot-val-name"
                            />
                          </div>
                        </>
                      )}

                      <div className="text-[10px] text-yellow-700 bg-yellow-100/50 p-2 rounded">
                        {selectedNode.data.pivotMode === 'unpivot' 
                          ? 'Converts wide-format data to long format (melts columns into rows).'
                          : 'Converts long-format data to wide format (spreads values into columns).'}
                      </div>
                    </div>
                  )}

                  {selectedNode.data.type === 'python' && (
                    <div className="space-y-4 border rounded-md p-3 bg-muted/20">
                       <div className="space-y-2">
                         <Label className="flex justify-between">
                            <span>Python Code</span>
                            <span className="text-[10px] text-muted-foreground font-mono">pandas available as pd</span>
                         </Label>
                         <div 
                            className="h-48 border rounded-md overflow-hidden"
                            onKeyDown={(e) => e.stopPropagation()}
                            onKeyUp={(e) => e.stopPropagation()}
                            onKeyPress={(e) => e.stopPropagation()}
                         >
                            <Editor
                               height="100%"
                               defaultLanguage="python"
                               value={selectedNode.data.code || "# Write your transformation here\n# df = input_df.copy()\n# df['new_col'] = df['val'] * 2\n# return df"}
                               theme="light"
                               options={{ minimap: { enabled: false }, fontSize: 11, lineNumbers: 'off' }}
                               onChange={(val) => updateNodeData('code', val)}
                            />
                         </div>
                       </div>
                       
                       {previewLoading && (
                         <div className="text-center py-4 text-muted-foreground text-sm">
                           Loading input data...
                         </div>
                       )}
                       
                       {!previewLoading && previewData && previewData.columns.length > 0 && (
                         <div className="space-y-2">
                           <Label className="flex items-center justify-between">
                             <span>Input Data Preview</span>
                             <span className="text-[10px] text-muted-foreground">
                               {previewData.rows.length} of {previewData.totalRows.toLocaleString()} rows
                             </span>
                           </Label>
                           <div className="border rounded-md overflow-auto max-h-48 bg-white">
                             <table className="w-full text-xs">
                               <thead className="bg-muted/50 sticky top-0">
                                 <tr>
                                   {previewData.columns.map((col) => (
                                     <th key={col} className="text-left font-medium p-2 border-b whitespace-nowrap">
                                       {col}
                                     </th>
                                   ))}
                                 </tr>
                               </thead>
                               <tbody>
                                 {previewData.rows.map((row, idx) => (
                                   <tr key={idx} className="hover:bg-muted/30">
                                     {previewData.columns.map((col) => (
                                       <td key={col} className="p-2 border-b font-mono whitespace-nowrap max-w-[200px] truncate">
                                         {row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}
                                       </td>
                                     ))}
                                   </tr>
                                 ))}
                               </tbody>
                             </table>
                           </div>
                         </div>
                       )}
                       
                       {!previewLoading && !previewData && (
                         <div className="text-center py-4 text-muted-foreground text-sm border rounded-md bg-white">
                           Connect a data source to see input data
                         </div>
                       )}
                    </div>
                  )}

                  {selectedNode.data.type === 'sql' && (
                    <div className="space-y-4 border rounded-md p-3 bg-muted/20">
                       <div className="space-y-2">
                         <Label className="flex justify-between">
                            <span>SQL Query</span>
                            <span className="text-[10px] text-muted-foreground font-mono">DuckDB Dialect</span>
                         </Label>
                         <div 
                            className="h-48 border rounded-md overflow-hidden"
                            onKeyDown={(e) => e.stopPropagation()}
                            onKeyUp={(e) => e.stopPropagation()}
                            onKeyPress={(e) => e.stopPropagation()}
                         >
                            <Editor
                               height="100%"
                               defaultLanguage="sql"
                               value={selectedNode.data.query || "SELECT * FROM input_table\nWHERE region = 'US'\nLIMIT 100"}
                               theme="light"
                               options={{ minimap: { enabled: false }, fontSize: 11, lineNumbers: 'off' }}
                               onChange={(val) => updateNodeData('query', val)}
                            />
                         </div>
                       </div>
                       
                       {previewLoading && (
                         <div className="text-center py-4 text-muted-foreground text-sm">
                           Loading input data...
                         </div>
                       )}
                       
                       {!previewLoading && previewData && previewData.columns.length > 0 && (
                         <div className="space-y-2">
                           <Label className="flex items-center justify-between">
                             <span>Input Data Preview</span>
                             <span className="text-[10px] text-muted-foreground">
                               {previewData.rows.length} of {previewData.totalRows.toLocaleString()} rows
                             </span>
                           </Label>
                           <div className="border rounded-md overflow-auto max-h-48 bg-white">
                             <table className="w-full text-xs">
                               <thead className="bg-muted/50 sticky top-0">
                                 <tr>
                                   {previewData.columns.map((col) => (
                                     <th key={col} className="text-left font-medium p-2 border-b whitespace-nowrap">
                                       {col}
                                     </th>
                                   ))}
                                 </tr>
                               </thead>
                               <tbody>
                                 {previewData.rows.map((row, idx) => (
                                   <tr key={idx} className="hover:bg-muted/30">
                                     {previewData.columns.map((col) => (
                                       <td key={col} className="p-2 border-b font-mono whitespace-nowrap max-w-[200px] truncate">
                                         {row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}
                                       </td>
                                     ))}
                                   </tr>
                                 ))}
                               </tbody>
                             </table>
                           </div>
                         </div>
                       )}
                       
                       {!previewLoading && !previewData && (
                         <div className="text-center py-4 text-muted-foreground text-sm border rounded-md bg-white">
                           Connect a data source to see input data
                         </div>
                       )}
                    </div>
                  )}

                  {selectedNode.data.type === 'groupby' && (
                    <div className="space-y-4 border rounded-md p-3 bg-muted/20">
                      <div className="space-y-2">
                         <Label>Group By Columns</Label>
                         <ColumnMultiSelect
                           label="Group Columns"
                           selectedCols={selectedNode.data.groupCols || []}
                           availableCols={getSourceColumns(selectedNode.id)}
                           onChange={(cols) => updateNodeData('groupCols', cols)}
                           testId="select-group-columns"
                         />
                      </div>
                      <div className="space-y-2">
                         <Label>Aggregation Column</Label>
                         <Select 
                           value={selectedNode.data.aggColumn || ''} 
                           onValueChange={(val) => updateNodeData('aggColumn', val)}
                         >
                           <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-agg-column">
                             <SelectValue placeholder="Select column..." />
                           </SelectTrigger>
                           <SelectContent>
                             {getSourceColumns(selectedNode.id).map(col => (
                               <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-2">
                         <Label>Aggregation Function</Label>
                         <Select 
                           value={selectedNode.data.aggFunc || 'sum'} 
                           onValueChange={(val) => updateNodeData('aggFunc', val)}
                         >
                           <SelectTrigger className="h-8" data-testid="select-agg-function">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="sum">Sum</SelectItem>
                             <SelectItem value="mean">Mean</SelectItem>
                             <SelectItem value="count">Count</SelectItem>
                             <SelectItem value="min">Min</SelectItem>
                             <SelectItem value="max">Max</SelectItem>
                             <SelectItem value="std">Std Dev</SelectItem>
                           </SelectContent>
                         </Select>
                      </div>
                    </div>
                  )}

                  {selectedNode.data.type === 'exploration' && (
                    <div className="space-y-4 border border-emerald-100 rounded-md p-3 bg-emerald-50/50">
                      <div className="space-y-2">
                        <Label className="text-emerald-800 font-semibold">Chart Type</Label>
                        <Select
                          value={selectedNode.data.chartType || ''}
                          onValueChange={(val) => {
                            updateNodeData('chartType', val);
                            updateNodeData('chartConfig', {});
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs" data-testid="select-chart-type">
                            <SelectValue placeholder="Select chart type..." />
                          </SelectTrigger>
                          <SelectContent>
                            {CHART_TYPES.map(ct => (
                              <SelectItem key={ct.value} value={ct.value} className="text-xs">
                                <div>
                                  <span className="font-medium">{ct.label}</span>
                                  <span className="text-muted-foreground ml-2">— {ct.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedNode.data.chartType && ['timeseries', 'seasonal'].includes(selectedNode.data.chartType) && (
                        <div className="space-y-2">
                          <Label className="text-xs text-emerald-700">Date Column</Label>
                          <Select
                            value={selectedNode.data.chartConfig?.dateColumn || ''}
                            onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, dateColumn: val })}
                          >
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-date-column">
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getSourceColumns(selectedNode.id).map(col => (
                                <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Label className="text-xs text-emerald-700">Value Column</Label>
                          <Select
                            value={selectedNode.data.chartConfig?.valueColumn || ''}
                            onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, valueColumn: val })}
                          >
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-value-column">
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getSourceColumns(selectedNode.id).map(col => (
                                <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {selectedNode.data.chartType === 'histogram' && (
                        <div className="space-y-2">
                          <Label className="text-xs text-emerald-700">Value Column</Label>
                          <Select
                            value={selectedNode.data.chartConfig?.valueColumn || ''}
                            onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, valueColumn: val })}
                          >
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-histogram-value">
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getSourceColumns(selectedNode.id).map(col => (
                                <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {selectedNode.data.chartType && ['boxplot', 'bar', 'pareto'].includes(selectedNode.data.chartType) && (
                        <div className="space-y-2">
                          <Label className="text-xs text-emerald-700">Group Column</Label>
                          <Select
                            value={selectedNode.data.chartConfig?.groupColumn || ''}
                            onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, groupColumn: val })}
                          >
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-group-column-chart">
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getSourceColumns(selectedNode.id).map(col => (
                                <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Label className="text-xs text-emerald-700">Value Column</Label>
                          <Select
                            value={selectedNode.data.chartConfig?.valueColumn || ''}
                            onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, valueColumn: val })}
                          >
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-value-column-chart">
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getSourceColumns(selectedNode.id).map(col => (
                                <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {selectedNode.data.chartType === 'scatter' && (
                        <div className="space-y-2">
                          <Label className="text-xs text-emerald-700">X Column</Label>
                          <Select
                            value={selectedNode.data.chartConfig?.xColumn || ''}
                            onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, xColumn: val })}
                          >
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-x-column">
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getSourceColumns(selectedNode.id).map(col => (
                                <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Label className="text-xs text-emerald-700">Y Column</Label>
                          <Select
                            value={selectedNode.data.chartConfig?.yColumn || ''}
                            onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, yColumn: val })}
                          >
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-y-column">
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getSourceColumns(selectedNode.id).map(col => (
                                <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {selectedNode.data.chartType === 'richtext' && (
                        <div className="space-y-2">
                          <Label className="text-xs text-emerald-700 font-semibold">Text Content</Label>
                          <div className="min-h-[250px]">
                            {renderChart('richtext', { columns: [], rows: [], totalRows: 0 }, {
                              ...selectedNode.data.chartConfig,
                              onRichTextChange: (html: string) => {
                                updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, richTextContent: html });
                              }
                            })}
                          </div>
                        </div>
                      )}

                      {selectedNode.data.chartType === 'adicv' && (
                        <div className="space-y-2">
                          <Label className="text-xs text-emerald-700">ID Column (DFU / SKU)</Label>
                          <Select
                            value={selectedNode.data.chartConfig?.idColumn || ''}
                            onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, idColumn: val })}
                          >
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-id-column">
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getSourceColumns(selectedNode.id).map(col => (
                                <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Label className="text-xs text-emerald-700">Date Column</Label>
                          <Select
                            value={selectedNode.data.chartConfig?.dateColumn || ''}
                            onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, dateColumn: val })}
                          >
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-adicv-date">
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getSourceColumns(selectedNode.id).map(col => (
                                <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Label className="text-xs text-emerald-700">Actuals / Demand Column</Label>
                          <Select
                            value={selectedNode.data.chartConfig?.demandColumn || ''}
                            onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, demandColumn: val })}
                          >
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-demand-column">
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getSourceColumns(selectedNode.id).map(col => (
                                <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Label className="text-xs text-emerald-700">Forecast Column <span className="text-muted-foreground">(optional, for MAPE)</span></Label>
                          <Select
                            value={selectedNode.data.chartConfig?.forecastColumn || ''}
                            onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, forecastColumn: val === '__none__' ? undefined : val })}
                          >
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-forecast-column">
                              <SelectValue placeholder="Select column (optional)..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="font-mono text-xs text-muted-foreground">None</SelectItem>
                              {getSourceColumns(selectedNode.id).map(col => (
                                <SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {selectedNode.data.chartType === 'forecast_actual' && (
                        <div className="space-y-2">
                          <Label className="text-xs text-emerald-700">Date Column</Label>
                          <Select value={selectedNode.data.chartConfig?.dateColumn || ''} onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, dateColumn: val })}>
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-fva-date"><SelectValue placeholder="Select column..." /></SelectTrigger>
                            <SelectContent>{getSourceColumns(selectedNode.id).map(col => (<SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>))}</SelectContent>
                          </Select>
                          <Label className="text-xs text-emerald-700">Actual Column</Label>
                          <Select value={selectedNode.data.chartConfig?.actualColumn || ''} onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, actualColumn: val })}>
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-fva-actual"><SelectValue placeholder="Select column..." /></SelectTrigger>
                            <SelectContent>{getSourceColumns(selectedNode.id).map(col => (<SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>))}</SelectContent>
                          </Select>
                          <Label className="text-xs text-emerald-700">New Forecast Column</Label>
                          <Select value={selectedNode.data.chartConfig?.newForecastColumn || ''} onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, newForecastColumn: val })}>
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-fva-new-forecast"><SelectValue placeholder="Select column..." /></SelectTrigger>
                            <SelectContent>{getSourceColumns(selectedNode.id).map(col => (<SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>))}</SelectContent>
                          </Select>
                          <Label className="text-xs text-emerald-700">Incumbent Forecast <span className="text-muted-foreground">(optional)</span></Label>
                          <Select value={selectedNode.data.chartConfig?.incumbentForecastColumn || ''} onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, incumbentForecastColumn: val === '__none__' ? undefined : val })}>
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-fva-incumbent"><SelectValue placeholder="Select column (optional)..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="font-mono text-xs text-muted-foreground">None</SelectItem>
                              {getSourceColumns(selectedNode.id).map(col => (<SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <Label className="text-xs text-emerald-700">Fold Column <span className="text-muted-foreground">(optional)</span></Label>
                          <Select value={selectedNode.data.chartConfig?.foldColumn || ''} onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, foldColumn: val === '__none__' ? undefined : val })}>
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-fva-fold"><SelectValue placeholder="Select column (optional)..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="font-mono text-xs text-muted-foreground">None</SelectItem>
                              {getSourceColumns(selectedNode.id).map(col => (<SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <Label className="text-xs text-emerald-700">Lower Bound <span className="text-muted-foreground">(optional)</span></Label>
                          <Select value={selectedNode.data.chartConfig?.lowerBoundColumn || ''} onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, lowerBoundColumn: val === '__none__' ? undefined : val })}>
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-fva-lower"><SelectValue placeholder="Select column (optional)..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="font-mono text-xs text-muted-foreground">None</SelectItem>
                              {getSourceColumns(selectedNode.id).map(col => (<SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <Label className="text-xs text-emerald-700">Upper Bound <span className="text-muted-foreground">(optional)</span></Label>
                          <Select value={selectedNode.data.chartConfig?.upperBoundColumn || ''} onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, upperBoundColumn: val === '__none__' ? undefined : val })}>
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-fva-upper"><SelectValue placeholder="Select column (optional)..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="font-mono text-xs text-muted-foreground">None</SelectItem>
                              {getSourceColumns(selectedNode.id).map(col => (<SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {selectedNode.data.chartType === 'backtest_metrics' && (
                        <div className="space-y-2">
                          <Label className="text-xs text-emerald-700">Date Column</Label>
                          <Select value={selectedNode.data.chartConfig?.dateColumn || ''} onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, dateColumn: val })}>
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-btm-date"><SelectValue placeholder="Select column..." /></SelectTrigger>
                            <SelectContent>{getSourceColumns(selectedNode.id).map(col => (<SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>))}</SelectContent>
                          </Select>
                          <Label className="text-xs text-emerald-700">Actual Column</Label>
                          <Select value={selectedNode.data.chartConfig?.actualColumn || ''} onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, actualColumn: val })}>
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-btm-actual"><SelectValue placeholder="Select column..." /></SelectTrigger>
                            <SelectContent>{getSourceColumns(selectedNode.id).map(col => (<SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>))}</SelectContent>
                          </Select>
                          <Label className="text-xs text-emerald-700">New Forecast Column</Label>
                          <Select value={selectedNode.data.chartConfig?.newForecastColumn || ''} onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, newForecastColumn: val })}>
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-btm-new-forecast"><SelectValue placeholder="Select column..." /></SelectTrigger>
                            <SelectContent>{getSourceColumns(selectedNode.id).map(col => (<SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>))}</SelectContent>
                          </Select>
                          <Label className="text-xs text-emerald-700">Incumbent Forecast <span className="text-muted-foreground">(optional)</span></Label>
                          <Select value={selectedNode.data.chartConfig?.incumbentForecastColumn || ''} onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, incumbentForecastColumn: val === '__none__' ? undefined : val })}>
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-btm-incumbent"><SelectValue placeholder="Select column (optional)..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="font-mono text-xs text-muted-foreground">None</SelectItem>
                              {getSourceColumns(selectedNode.id).map(col => (<SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <Label className="text-xs text-emerald-700">Fold Column <span className="text-muted-foreground">(optional, for per-fold breakdown)</span></Label>
                          <Select value={selectedNode.data.chartConfig?.foldColumn || ''} onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, foldColumn: val === '__none__' ? undefined : val })}>
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-btm-fold"><SelectValue placeholder="Select column (optional)..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="font-mono text-xs text-muted-foreground">None</SelectItem>
                              {getSourceColumns(selectedNode.id).map(col => (<SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <Label className="text-xs text-emerald-700">Group Column <span className="text-muted-foreground">(optional, for per-item breakdown)</span></Label>
                          <Select value={selectedNode.data.chartConfig?.groupColumn || ''} onValueChange={(val) => updateNodeData('chartConfig', { ...selectedNode.data.chartConfig, groupColumn: val === '__none__' ? undefined : val })}>
                            <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-btm-group"><SelectValue placeholder="Select column (optional)..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="font-mono text-xs text-muted-foreground">None</SelectItem>
                              {getSourceColumns(selectedNode.id).map(col => (<SelectItem key={col} value={col} className="font-mono text-xs">{col}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-xs text-emerald-700">Takeaway / Notes</Label>
                        <Textarea
                          value={selectedNode.data.takeaway || ''}
                          onChange={(e) => updateNodeData('takeaway', e.target.value)}
                          placeholder="Key findings or notes about this chart..."
                          className="text-xs min-h-[60px] bg-white"
                          data-testid="textarea-takeaway"
                        />
                      </div>

                      {selectedNode.data.chartType && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-emerald-700 font-semibold">Chart Preview</Label>
                            <div className="flex items-center gap-1">
                              {explorationPreview && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-emerald-600 hover:bg-emerald-50 px-2"
                                  onClick={() => exportChartSVG(chartPreviewRef.current, selectedNode.data.label || 'chart')}
                                  title="Export chart as SVG"
                                  data-testid="button-export-chart-svg"
                                >
                                  <Download className="w-3 h-3 mr-1" /> SVG
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                onClick={fetchExplorationPreview}
                                disabled={explorationPreviewLoading}
                                data-testid="button-load-preview"
                              >
                                {explorationPreviewLoading ? (
                                  <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-1" />
                                ) : null}
                                {explorationPreviewLoading ? 'Loading...' : 'Load Preview'}
                              </Button>
                            </div>
                          </div>
                          {explorationPreview && (
                            <div ref={chartPreviewRef} className="border border-emerald-200 rounded-md bg-white p-2 overflow-hidden" data-testid="chart-preview-container">
                              {renderChart(selectedNode.data.chartType, explorationPreview, selectedNode.data.chartConfig || {})}
                            </div>
                          )}
                          {!explorationPreview && !explorationPreviewLoading && (
                            <p className="text-[11px] text-emerald-600">Click "Load Preview" to see the chart</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedNode.data.type === 'report' && (
                    <div className="space-y-4 border border-violet-100 rounded-md p-3 bg-violet-50/50">
                      <div className="space-y-2">
                        <Label className="text-violet-800 font-semibold">Report Title</Label>
                        <Input
                          value={selectedNode.data.reportTitle || ''}
                          onChange={(e) => updateNodeData('reportTitle', e.target.value)}
                          placeholder="Enter report title..."
                          className="h-8 text-sm bg-white"
                          data-testid="input-report-title"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-violet-700 font-semibold">Connected Explorations</Label>
                        <p className="text-[10px] text-muted-foreground">Drag or use arrows to reorder</p>
                        {(() => {
                          const incomingEdges = edges.filter(e => e.target === selectedNode.id);
                          const connectedExplorations = incomingEdges
                            .map(e => nodes.find(n => n.id === e.source))
                            .filter(n => n && n.data.type === 'exploration');
                          
                          if (connectedExplorations.length === 0) {
                            return (
                              <div className="text-center py-3 text-muted-foreground text-xs border border-violet-200 rounded-md bg-white" data-testid="text-no-explorations">
                                No exploration nodes connected. Connect exploration nodes to include them in the report.
                              </div>
                            );
                          }

                          const savedOrder: string[] = selectedNode.data.explorationOrder || [];
                          const orderedExplorations = [
                            ...savedOrder.map(id => connectedExplorations.find(n => n?.id === id)).filter(Boolean),
                            ...connectedExplorations.filter(n => n && !savedOrder.includes(n.id))
                          ];

                          const moveExploration = (fromIdx: number, toIdx: number) => {
                            const newOrder = orderedExplorations.map(n => n!.id);
                            const [moved] = newOrder.splice(fromIdx, 1);
                            newOrder.splice(toIdx, 0, moved);
                            updateNodeData('explorationOrder', newOrder);
                          };

                          return (
                            <div className="space-y-1" data-testid="list-connected-explorations">
                              {orderedExplorations.map((expNode, idx) => {
                                if (!expNode) return null;
                                const chartLabel = CHART_TYPES.find(ct => ct.value === expNode.data.chartType)?.label;
                                return (
                                  <div
                                    key={expNode.id}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('text/plain', String(idx));
                                      e.dataTransfer.effectAllowed = 'move';
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      e.dataTransfer.dropEffect = 'move';
                                      e.currentTarget.classList.add('ring-2', 'ring-violet-400');
                                    }}
                                    onDragLeave={(e) => {
                                      e.currentTarget.classList.remove('ring-2', 'ring-violet-400');
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.currentTarget.classList.remove('ring-2', 'ring-violet-400');
                                      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                                      if (!isNaN(fromIdx) && fromIdx !== idx) {
                                        moveExploration(fromIdx, idx);
                                      }
                                    }}
                                    className="flex items-center gap-1.5 p-2 rounded-md bg-white border border-violet-200 text-xs cursor-grab active:cursor-grabbing transition-all hover:border-violet-400"
                                    data-testid={`exploration-item-${idx}`}
                                  >
                                    <GripVertical className="w-3 h-3 text-violet-300 shrink-0" />
                                    <span className="text-[10px] text-violet-400 font-mono w-4 shrink-0">{idx + 1}</span>
                                    <span className="font-medium text-slate-700 flex-1 truncate">{expNode.data.label}</span>
                                    {chartLabel && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 shrink-0">{chartLabel}</span>
                                    )}
                                    {!chartLabel && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">Not configured</span>
                                    )}
                                    <div className="flex flex-col shrink-0">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); if (idx > 0) moveExploration(idx, idx - 1); }}
                                        disabled={idx === 0}
                                        className="p-0.5 hover:bg-violet-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                        data-testid={`button-move-up-${idx}`}
                                      >
                                        <ArrowUp className="w-2.5 h-2.5 text-violet-600" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); if (idx < orderedExplorations.length - 1) moveExploration(idx, idx + 1); }}
                                        disabled={idx === orderedExplorations.length - 1}
                                        className="p-0.5 hover:bg-violet-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                        data-testid={`button-move-down-${idx}`}
                                      >
                                        <ArrowDown className="w-2.5 h-2.5 text-violet-600" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      <Separator className="bg-violet-200" />

                      <Button
                        className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                        onClick={loadReportPreview}
                        disabled={reportPreviewLoading}
                        data-testid="button-view-report"
                      >
                        {reportPreviewLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        ) : (
                          <BarChart3 className="w-4 h-4 mr-2" />
                        )}
                        {reportPreviewLoading ? 'Loading Report...' : 'View Report'}
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full border-violet-300 text-violet-700 hover:bg-violet-100"
                        onClick={openExportDialog}
                        data-testid="button-export-report"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Export HTML Report
                      </Button>
                    </div>
                  )}

                  <Separator />
                  
                  {/* Delete Section - Prominent */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-800">Remove Component</p>
                        <p className="text-xs text-red-600">This will also disconnect all edges</p>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={deleteSelectedNode}
                        className="h-9 px-4"
                        data-testid="button-delete-node"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-[10px] text-muted-foreground text-center pt-2">ID: {selectedNode.id}</p>
                </CardContent>
              </Card>
            </Panel>
          )}

          {selectedEdgeData && (
             <Panel position="top-left" style={{ left: selectedEdgeData.x - 250, top: selectedEdgeData.y - 120, pointerEvents: 'none' }}>
                <Card className="w-64 shadow-xl border-blue-200 bg-blue-50/90 backdrop-blur-sm pointer-events-auto">
                   <CardHeader className="p-3 pb-2">
                      <CardTitle className="text-xs font-bold text-blue-800 flex items-center gap-2">
                         <Activity className="w-3 h-3" /> Data Flow Inspector
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="p-3 pt-0">
                      <div className="space-y-1 text-xs">
                         <div className="flex justify-between">
                            <span className="text-muted-foreground">From:</span>
                            <span className="font-mono">{selectedEdgeData.sourceNode?.data.label}</span>
                         </div>
                         <div className="flex justify-between">
                            <span className="text-muted-foreground">To:</span>
                            <span className="font-mono">{selectedEdgeData.targetNode?.data.label}</span>
                         </div>
                         {nodeOutputShapes[selectedEdgeData.sourceNode?.id] && (
                           <>
                             <Separator className="my-1 bg-blue-200" />
                             <div className="flex justify-between font-semibold">
                                <span>Data Shape:</span>
                                <span className="font-mono">
                                  {nodeOutputShapes[selectedEdgeData.sourceNode?.id]?.rows?.toLocaleString()} × {nodeOutputShapes[selectedEdgeData.sourceNode?.id]?.cols}
                                </span>
                             </div>
                           </>
                         )}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          className="h-7 flex-1 text-xs"
                          onClick={() => {
                            disconnectSource(selectedEdgeData.id);
                            setSelectedEdgeData(null);
                          }}
                          data-testid="button-delete-edge"
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 flex-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100" 
                          onClick={() => setSelectedEdgeData(null)}
                        >
                          Close
                        </Button>
                      </div>
                   </CardContent>
                </Card>
             </Panel>
          )}

          <NodePalette 
            onDragStart={onNodeDragStart}
            onAddNode={onAddNode}
            isOpen={paletteOpen} 
            onToggle={() => setPaletteOpen(!paletteOpen)} 
          />

        </ReactFlow>

        {quickConnectMenu && (() => {
          const menuHeight = 420;
          const spaceBelow = window.innerHeight - quickConnectMenu.y - 16;
          const spaceAbove = quickConnectMenu.y - 16;
          const fitsBelow = spaceBelow >= menuHeight;
          const top = fitsBelow ? quickConnectMenu.y : Math.max(16, quickConnectMenu.y - Math.min(menuHeight, spaceAbove));
          const availableHeight = fitsBelow ? spaceBelow : Math.min(menuHeight, quickConnectMenu.y - 16);
          const left = Math.min(quickConnectMenu.x, window.innerWidth - 270);
          return (
          <div 
            className="fixed z-[100] animate-in fade-in zoom-in-95 duration-150"
            style={{ left, top }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="w-64 shadow-xl border-border/60 bg-white flex flex-col" style={{ maxHeight: availableHeight }}>
              <CardContent className="p-2 overflow-y-auto">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-2 pt-1">
                  Add & connect
                </p>
                <div className="space-y-1">
                  {nodeCategories.map((category) => (
                    <div key={category.label}>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest px-2 pt-1.5 pb-0.5">{category.label}</p>
                      {category.nodes.map((node) => (
                        <button
                          key={node.type}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/80 transition-colors text-left"
                          onClick={(e) => { e.stopPropagation(); onQuickConnectSelect(node.type, node.label); }}
                          data-testid={`quick-connect-${node.type}`}
                        >
                          <div className={cn("p-1 rounded", node.color)}>
                            <node.icon className="w-3 h-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{node.label}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          );
        })()}
      </div>

      {/* Right-click context menu */}
      {contextMenu && createPortal(
        <div
          className="fixed z-[9999] bg-white border rounded-lg shadow-xl py-1 min-w-[160px] text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}
        >
          {(() => {
            const ctxNode = nodes.find(n => n.id === contextMenu.nodeId);
            if (!ctxNode) return null;
            const duplicate = () => {
              const newId = getId();
              const newNode = { ...ctxNode, id: newId, position: { x: ctxNode.position.x + 40, y: ctxNode.position.y + 40 }, data: { ...ctxNode.data }, selected: false };
              pushHistory(nodesRef.current, edgesRef.current);
              setNodes(ns => [...ns, newNode]);
              setContextMenu(null);
              toast.success('Node duplicated');
            };
            const rename = () => {
              const label = window.prompt('New node name:', ctxNode.data.label || '');
              if (label !== null) {
                setNodes(ns => ns.map(n => n.id === ctxNode.id ? { ...n, data: { ...n.data, label } } : n));
                if (selectedNode?.id === ctxNode.id) setSelectedNode((prev: any) => ({ ...prev, data: { ...prev.data, label } }));
              }
              setContextMenu(null);
            };
            const disconnectAll = () => {
              pushHistory(nodesRef.current, edgesRef.current);
              setEdges(es => es.filter(e => e.source !== ctxNode.id && e.target !== ctxNode.id));
              setContextMenu(null);
              toast.info('All connections removed');
            };
            const deleteNode = () => {
              pushHistory(nodesRef.current, edgesRef.current);
              setNodes(ns => ns.filter(n => n.id !== ctxNode.id));
              setEdges(es => es.filter(e => e.source !== ctxNode.id && e.target !== ctxNode.id));
              if (selectedNode?.id === ctxNode.id) setSelectedNode(null);
              setContextMenu(null);
            };
            return (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b truncate max-w-[200px]">{ctxNode.data.label}</div>
                <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 text-left" onClick={duplicate} data-testid="ctx-duplicate">
                  <Copy className="w-3.5 h-3.5" /> Duplicate
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 text-left" onClick={rename} data-testid="ctx-rename">
                  <MousePointer2 className="w-3.5 h-3.5" /> Rename
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 text-left" onClick={disconnectAll} data-testid="ctx-disconnect">
                  <Link2Off className="w-3.5 h-3.5" /> Disconnect All
                </button>
                <div className="border-t my-1" />
                <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 text-red-600 text-left" onClick={deleteNode} data-testid="ctx-delete">
                  <Trash2 className="w-3.5 h-3.5" /> Delete Node
                </button>
              </>
            );
          })()}
        </div>,
        document.body
      )}

      {/* Ctrl+K Command Palette */}
      <Dialog open={cmdPaletteOpen} onOpenChange={v => { setCmdPaletteOpen(v); if (!v) setCmdQuery(''); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden" aria-describedby="cmd-palette-desc">
          <div className="flex items-center border-b px-4 py-3 gap-3">
            <Command className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              placeholder="Add node or run action…"
              value={cmdQuery}
              onChange={e => setCmdQuery(e.target.value)}
              data-testid="input-cmd-palette"
            />
            <kbd className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">ESC</kbd>
          </div>
          <DialogTitle className="sr-only">Command Palette</DialogTitle>
          <DialogDescription id="cmd-palette-desc" className="sr-only">Search and add nodes or run pipeline actions</DialogDescription>
          <ScrollArea className="max-h-[400px]">
            {(() => {
              const q = cmdQuery.toLowerCase();
              const actions = [
                { label: 'Run Pipeline', icon: Play, action: () => { setCmdPaletteOpen(false); const runBtn = document.querySelector('[data-testid="button-run-pipeline"]') as HTMLButtonElement; runBtn?.click(); }, group: 'Actions' },
                { label: 'Auto Layout', icon: LayoutTemplate, action: () => { setCmdPaletteOpen(false); setTimeout(() => (document.querySelector('[data-testid="button-auto-layout"]') as HTMLButtonElement)?.click(), 50); }, group: 'Actions' },
                { label: 'Save Pipeline', icon: Save, action: () => { setCmdPaletteOpen(false); setTimeout(() => (document.querySelector('[data-testid="button-save-pipeline"]') as HTMLButtonElement)?.click(), 50); }, group: 'Actions' },
              ].filter(a => !q || a.label.toLowerCase().includes(q));

              const allNodeTypes = nodeCategories.flatMap((cat: any) => cat.nodes.map((n: any) => ({ ...n, group: cat.label })));
              const filteredNodes = allNodeTypes.filter((n: any) => !q || n.label.toLowerCase().includes(q) || n.type.toLowerCase().includes(q));

              return (
                <div className="py-2">
                  {actions.length > 0 && (
                    <div>
                      <p className="px-4 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Actions</p>
                      {actions.map((a: any) => (
                        <button key={a.label} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/50 text-sm text-left" onClick={a.action}>
                          <a.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span>{a.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {filteredNodes.length > 0 && (
                    <div>
                      <p className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">Add Node</p>
                      {filteredNodes.slice(0, 20).map((n: any) => (
                        <button key={n.type} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/50 text-sm text-left" data-testid={`cmd-node-${n.type}`}
                          onClick={() => {
                            setCmdPaletteOpen(false);
                            const rf = document.querySelector('.react-flow__pane') as HTMLElement;
                            const cx = rf ? rf.getBoundingClientRect().left + rf.getBoundingClientRect().width / 2 : 400;
                            const cy = rf ? rf.getBoundingClientRect().top + rf.getBoundingClientRect().height / 2 : 300;
                            const newNode = {
                              id: getId(),
                              type: 'custom',
                              position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
                              data: { type: n.type, label: n.label },
                            };
                            pushHistory(nodesRef.current, edgesRef.current);
                            setNodes(ns => [...ns, newNode]);
                            toast.success(`Added ${n.label}`);
                          }}>
                          <div className={cn('p-1 rounded', n.color || 'bg-muted')}>
                            <n.icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{n.label}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{n.group}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {actions.length === 0 && filteredNodes.length === 0 && (
                    <p className="px-4 py-6 text-sm text-muted-foreground text-center">No results for "{cmdQuery}"</p>
                  )}
                </div>
              );
            })()}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={resultsOpen} onOpenChange={setResultsOpen}>
        <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 flex flex-col overflow-hidden">
           <div className="p-6 border-b shrink-0 flex items-center justify-between">
              <div>
                 <DialogTitle className="text-xl">Forecast Results</DialogTitle>
                 <DialogDescription>Performance metrics and predictions.</DialogDescription>
              </div>
           </div>
           <ScrollArea className="flex-1 p-6 bg-slate-50/50">
              <ForecastResultsDashboard results={resultsModelInfo} />
           </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={reportPreviewOpen} onOpenChange={setReportPreviewOpen}>
        <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 flex flex-col overflow-hidden">
          <div className="p-6 border-b shrink-0 flex items-center justify-between bg-white z-20">
            <div>
              <DialogTitle className="text-xl">{selectedNode?.data.reportTitle || 'Report Preview'}</DialogTitle>
              <DialogDescription>{reportPreviewData.length} exploration(s) &bull; Generated {new Date().toLocaleDateString()}</DialogDescription>
            </div>
            <Button variant="outline" className="gap-2 border-violet-200 text-violet-700 hover:bg-violet-50" onClick={openExportDialog}>
              <FileText className="w-4 h-4" /> Export HTML
            </Button>
          </div>
          <ScrollArea className="flex-1 p-6 bg-slate-50/50">
            <div className="max-w-4xl mx-auto space-y-6" data-testid="report-preview-content">
              {reportPreviewData.map((section, idx) => {
                const chartLabel = CHART_TYPES.find(ct => ct.value === section.chartType)?.label || 'Not configured';
                return (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(idx));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      e.currentTarget.classList.add('ring-2', 'ring-violet-400');
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('ring-2', 'ring-violet-400');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('ring-2', 'ring-violet-400');
                      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                      if (!isNaN(fromIdx) && fromIdx !== idx) {
                        setReportPreviewData(prev => {
                          const newArr = [...prev];
                          const [moved] = newArr.splice(fromIdx, 1);
                          newArr.splice(idx, 0, moved);
                          if (selectedNode) {
                            const incomingEdges = edges.filter(e => e.target === selectedNode.id);
                            const connectedExplorations = incomingEdges
                              .map(e => nodes.find(n => n.id === e.source))
                              .filter(n => n && n.data.type === 'exploration');
                            const savedOrder: string[] = selectedNode.data.explorationOrder || [];
                            const currentOrder = [
                              ...savedOrder.map(id => connectedExplorations.find(n => n?.id === id)).filter(Boolean),
                              ...connectedExplorations.filter(n => n && !savedOrder.includes(n.id))
                            ];
                            const reorderedIds = [...currentOrder.map(n => n!.id)];
                            const [movedId] = reorderedIds.splice(fromIdx, 1);
                            reorderedIds.splice(idx, 0, movedId);
                            updateNodeData('explorationOrder', reorderedIds);
                          }
                          return newArr;
                        });
                      }
                    }}
                    data-testid={`report-section-${idx}`}
                  >
                  <Card className="overflow-hidden cursor-grab active:cursor-grabbing transition-all hover:ring-1 hover:ring-violet-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-slate-300" />
                          <CardTitle className="text-lg">{section.label}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">{idx + 1} of {reportPreviewData.length}</span>
                          <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">{chartLabel}</span>
                        </div>
                      </div>
                      {Object.entries(section.chartConfig).filter(([k,v]) => v && typeof v !== 'object' && typeof v !== 'function' && k !== 'richTextContent').length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {Object.entries(section.chartConfig).filter(([k,v]) => v && typeof v !== 'object' && typeof v !== 'function' && k !== 'richTextContent').map(([k,v]) => `${k}: ${v}`).join(' \u2022 ')}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent>
                      {section.chartType === 'richtext' ? (
                        <div>
                          {renderChart('richtext', { columns: [], rows: [], totalRows: 0 }, section.chartConfig)}
                        </div>
                      ) : section.data && section.chartType ? (
                        <div className="min-h-[200px]">
                          {renderChart(section.chartType, section.data, section.chartConfig)}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          {!section.chartType ? 'Chart type not configured' : 'No data available'}
                        </div>
                      )}
                      {section.takeaway && (
                        <div className="mt-4 p-3 bg-emerald-50 border-l-3 border-emerald-500 rounded-r-md">
                          <p className="text-sm text-emerald-800"><strong>Takeaway:</strong> {section.takeaway}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  </div>
                );
              })}
              {reportPreviewData.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">No explorations to display</div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export HTML Report</DialogTitle>
            <DialogDescription>Choose a filename for the exported report.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="export-filename">Filename</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="export-filename"
                  value={exportFilename}
                  onChange={(e) => setExportFilename(e.target.value)}
                  placeholder="Report filename"
                  data-testid="input-export-filename"
                  onKeyDown={(e) => { if (e.key === 'Enter') doExportHTML(); }}
                />
                <span className="text-sm text-muted-foreground shrink-0">.html</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setExportDialogOpen(false)} data-testid="button-cancel-export">
                Cancel
              </Button>
              <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={doExportHTML} data-testid="button-confirm-export">
                <FileText className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );

}

export default function FlowEditor() {
  return (
    <ReactFlowProvider>
      <FlowWithProvider />
    </ReactFlowProvider>
  );
}