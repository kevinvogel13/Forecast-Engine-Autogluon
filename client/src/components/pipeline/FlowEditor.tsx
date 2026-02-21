import { useCallback, useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
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
import { Play, Settings2, Trash2, X, FolderOpen, Save, BarChart3, Database, FileText, Activity, MoreHorizontal, ChevronDown, GitMerge, FilePlus, GripVertical, ArrowUp, ArrowDown, Upload, Cpu } from 'lucide-react';
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
import ConfigurationPanel from '@/components/configuration/ConfigurationPanel';
import ForecastResultsDashboard from '@/components/dashboard/ForecastResultsDashboard';
import NodePalette, { categories as nodeCategories } from './NodePalette';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Define custom node types
const nodeTypes: NodeTypes = {
  custom: PipelineNode,
};

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import Editor from '@monaco-editor/react';
import { CHART_TYPES, renderChart } from '@/components/exploration/ExplorationCharts';
import { HEADER_PORTAL_ID } from '@/components/layout/Shell';
import { usePipelines, useCreatePipeline, useUpdatePipeline, useDeletePipeline, useExecutePipeline } from '@/hooks/usePipelines';
import { useDatasets } from '@/hooks/useDatasets';

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
  const executePipeline = useExecutePipeline();
  const deletePipeline = useDeletePipeline();
  
  // Edge click popover state
  const [selectedEdgeData, setSelectedEdgeData] = useState<{ id: string, x: number, y: number, sourceNode: any, targetNode: any } | null>(null);
  
  // Store output data shapes for each node (nodeId -> { rows, cols })
  const [nodeOutputShapes, setNodeOutputShapes] = useState<Record<string, { rows: number; cols: number }>>({});
  
  // Modal states for full views
  const [configOpen, setConfigOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  
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

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({
      ...params,
      animated: true,
      style: defaultEdgeStyle,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' }
    }, eds)),
    [setEdges],
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

    const sourceNode = nodes.find(n => n.id === quickConnectMenu.sourceNodeId);
    const position = screenToFlowPosition({
      x: quickConnectMenu.x,
      y: quickConnectMenu.y,
    });

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
  }, [quickConnectMenu, nodes, screenToFlowPosition, setNodes, setEdges]);

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
    [screenToFlowPosition, setNodes],
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

  // Connect a source node to the currently selected node
  const connectFromNode = useCallback((sourceId: string) => {
    if (!selectedNode || sourceId === selectedNode.id) return;
    
    // Check if this connection already exists
    const existingEdge = edges.find(e => e.source === sourceId && e.target === selectedNode.id);
    if (existingEdge) return;
    
    const newEdge = {
      id: `e${sourceId}-${selectedNode.id}`,
      source: sourceId,
      target: selectedNode.id,
      animated: true,
      style: defaultEdgeStyle,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' }
    };
    
    setEdges((eds) => [...eds, newEdge]);
  }, [selectedNode, edges, setEdges]);

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
    setEdges((eds) => eds.filter(e => e.id !== edgeId));
  }, [setEdges]);
  
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
    if (node.data.type === 'filter' && node.data.filterColumn) {
      const multiSelectOps = ['isin', 'notin'];
      const noValueOps = ['isnull', 'notnull'];
      const op = node.data.filterOp || 'eq'; // Default to 'eq' if not set
      
      let value = node.data.filterValue;
      if (multiSelectOps.includes(op)) {
        value = node.data.filterValues || [];
      } else if (noValueOps.includes(op)) {
        value = null;
      }
      
      transforms.push({
        type: 'filter',
        data: { column: node.data.filterColumn, operator: op, value }
      });
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

  // Keep refs for nodes/edges to avoid dependency issues
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  // Compute a key that represents the current preview's upstream filter state
  const getPreviewKey = useCallback(() => {
    const previewNodeTypes = ['preview', 'python', 'sql'];
    if (!selectedNode || !previewNodeTypes.includes(selectedNode.data.type)) return '';
    
    // Find incoming edges to this node
    const incomingEdges = edges.filter(e => e.target === selectedNode.id);
    const upstreamNodeIds = incomingEdges.map(e => e.source).sort().join(',');
    
    // Get filter states from upstream nodes
    const filterStates = incomingEdges.map(e => {
      const sourceNode = nodes.find(n => n.id === e.source);
      if (sourceNode?.data.type === 'filter') {
        const op = sourceNode.data.filterOp || 'eq';
        const col = sourceNode.data.filterColumn || '';
        const val = ['isin', 'notin'].includes(op) 
          ? (sourceNode.data.filterValues || []).join('|')
          : (sourceNode.data.filterValue || '');
        return `${col}:${op}:${val}`;
      }
      return '';
    }).join(';');
    
    return `${upstreamNodeIds}|${filterStates}`;
  }, [selectedNode, nodes, edges]);

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
      if (node.data.type === 'filter' && node.data.filterColumn) {
        const multiSelectOps = ['isin', 'notin'];
        const noValueOps = ['isnull', 'notnull'];
        const op = node.data.filterOp || 'eq'; // Default to 'eq' if not set
        
        let value = node.data.filterValue;
        if (multiSelectOps.includes(op)) {
          value = node.data.filterValues || [];
        } else if (noValueOps.includes(op)) {
          value = null;
        }
        
        transforms.push({
          type: 'filter',
          data: { column: node.data.filterColumn, operator: op, value }
        });
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
  
  const runPipeline = () => {
    if (isRunning) return;
    
    if (!currentPipelineId) {
      toast.error("Please save the pipeline first");
      return;
    }
    
    setIsRunning(true);
    toast.info("Pipeline started...");

    // Reset all statuses first (except inputs which stay success)
    setNodes((nds) => 
      nds.map(n => ({
        ...n,
        data: {
          ...n.data,
          status: n.data.type === 'input' ? 'success' : 'pending'
        }
      }))
    );

    // Turn on edge animations
    setEdges((eds) => eds.map(e => ({ ...e, animated: true })));

    // Execute pipeline via API
    executePipeline.mutate(currentPipelineId, {
      onSuccess: () => {
        // Simple simulation for visual feedback
        const nonInputNodes = nodes.filter(n => n.data.type !== 'input').map(n => n.id);
        
        let delay = 1000;
        nonInputNodes.forEach((nodeId, index) => {
           setTimeout(() => {
              setNodes((nds) => 
                nds.map(n => {
                  if (n.id === nodeId) {
                     return { ...n, data: { ...n.data, status: 'processing' } };
                  }
                  return n;
                })
              );
           }, delay);

           delay += 2000;

           setTimeout(() => {
              setNodes((nds) => 
                nds.map(n => {
                  if (n.id === nodeId) {
                     return { ...n, data: { ...n.data, status: 'success' } };
                  }
                  return n;
                })
              );
              
              if (index === nonInputNodes.length - 1) {
                setIsRunning(false);
                setEdges((eds) => eds.map(e => ({ ...e, animated: false })));
              }
           }, delay);
           
           delay += 500;
        });
      },
      onError: () => {
        setIsRunning(false);
        setEdges((eds) => eds.map(e => ({ ...e, animated: false })));
      }
    });
  };
  
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
    const offset = nodes.length * 30;
    
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
  }, [screenToFlowPosition, setNodes, nodes.length]);

  return (
    <div className="flex h-full w-full bg-slate-50 overflow-hidden relative">
      <div className="flex-1 relative h-full" ref={reactFlowWrapper}>
        {/* Header Actions Portal */}
        {headerPortal && createPortal(
          <>
            {currentPipelineId && pipelineName && (
              <span className="text-xs text-muted-foreground border-r pr-3 mr-1 truncate max-w-[180px]" data-testid="text-pipeline-name">
                {pipelineName}
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" data-testid="button-file-menu">
                  <FileText className="w-3.5 h-3.5" />
                  File
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => {
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
                <DropdownMenuItem onClick={() => setLoadDialogOpen(true)} data-testid="menu-load">
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Open Pipeline
                </DropdownMenuItem>
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
                <DropdownMenuSeparator />
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
            <Button 
              size="sm" 
              className={`h-8 gap-1.5 text-xs ${isRunning ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}
              onClick={runPipeline}
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
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Open Pipeline</DialogTitle>
              <DialogDescription>
                Select a saved pipeline configuration to load.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[300px] mt-4 pr-4">
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
        
        <ReactFlow
          nodes={nodes}
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
          onPaneClick={() => { onPaneClick(); if (!quickConnectJustOpened.current) setQuickConnectMenu(null); }}
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
                                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                  Selected: {selectedNode.data.label}
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
                          <Label className="text-xs font-medium">Data Frequency</Label>
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

                       {modelMode === 'train' ? (
                          <div className="space-y-3">
                             <Label className="text-xs font-medium">Training Period</Label>
                             <div className="grid grid-cols-2 gap-3">
                                <div>
                                   <Label className="text-[10px] text-muted-foreground mb-1 block">Train Start</Label>
                                   <Input
                                      type="date"
                                      value={selectedNode.data.trainStart || ''}
                                      onChange={(e) => updateNodeData('trainStart', e.target.value)}
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
                                value={forecastHorizon}
                                onChange={(e) => updateNodeData('forecastHorizon', parseInt(e.target.value) || 1)}
                                className="h-8 text-xs w-20"
                                data-testid="input-forecast-horizon"
                             />
                             <span className="text-[10px] text-muted-foreground">{freqUnit} ahead</span>
                          </div>
                       </div>

                       <Separator />

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
                                      max={10}
                                      value={backtestFolds}
                                      onChange={(e) => updateNodeData('backtestFolds', Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
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
                                         value={backtestStepSize}
                                         onChange={(e) => updateNodeData('backtestStepSize', parseInt(e.target.value) || 1)}
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
                                         value={backtestGap}
                                         onChange={(e) => updateNodeData('backtestGap', parseInt(e.target.value) || 0)}
                                         className="h-8 text-xs w-20"
                                         data-testid="input-backtest-gap"
                                      />
                                      <span className="text-[10px] text-muted-foreground">{freqUnit} gap between train and test</span>
                                   </div>
                                </div>
                             </div>
                          )}
                       </div>

                       <Separator />

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

                       <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => setConfigOpen(true)} data-testid="button-configure-pipeline">
                          Configure Pipeline
                       </Button>
                    </div>
                    );
                  })()}

                  {selectedNode.data.type === 'output' && (
                    <div className="space-y-4 border rounded-md p-4 bg-green-50/50 border-green-100">
                       <div className="flex flex-col items-center justify-center text-center space-y-3 py-2">
                          <div className="bg-green-100 p-3 rounded-full">
                             <Activity className="w-6 h-6 text-green-600" />
                          </div>
                          <div>
                             <h4 className="text-sm font-semibold text-green-900">Forecast Output & Analysis</h4>
                             <p className="text-xs text-green-700 mt-1">Compare actual vs predicted values, view accuracy metrics, pattern classification (CV/ADI), and export results.</p>
                          </div>
                          <div className="w-full grid grid-cols-2 gap-2 text-xs">
                             <div className="bg-white/70 rounded p-2 border border-green-100 text-left">
                                <p className="text-green-800 font-medium">Accuracy Metrics</p>
                                <p className="text-green-600 text-[10px]">MAE, RMSE, MAPE</p>
                             </div>
                             <div className="bg-white/70 rounded p-2 border border-green-100 text-left">
                                <p className="text-green-800 font-medium">Pattern Analysis</p>
                                <p className="text-green-600 text-[10px]">CV vs ADI Classification</p>
                             </div>
                             <div className="bg-white/70 rounded p-2 border border-green-100 text-left col-span-2">
                                <p className="text-green-800 font-medium">Lag Comparison</p>
                                <p className="text-green-600 text-[10px]">Actual vs Forecast at specified lags</p>
                             </div>
                          </div>
                          <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => setResultsOpen(true)} data-testid="button-view-results">
                             View Results & Analysis
                          </Button>
                       </div>
                    </div>
                  )}

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

                  {selectedNode.data.type === 'filter' && (
                    <div className="space-y-4 border rounded-md p-3 bg-muted/20">
                      <div className="space-y-2">
                        <Label>Filter Column</Label>
                        <Select 
                           value={selectedNode.data.filterColumn || ''} 
                           onValueChange={(val) => {
                             updateNodeData('filterColumn', val);
                             updateNodeData('filterValue', '');
                             updateNodeData('filterValues', []);
                           }}
                        >
                          <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-filter-column">
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
                         <Label>Operator</Label>
                         <Select 
                            value={selectedNode.data.filterOp || 'eq'} 
                            onValueChange={(val) => {
                              updateNodeData('filterOp', val);
                              if (val === 'isin' || val === 'notin' || val === 'isnull' || val === 'notnull') {
                                updateNodeData('filterValue', '');
                              }
                              if (val !== 'isin' && val !== 'notin') {
                                updateNodeData('filterValues', []);
                              }
                            }}
                         >
                           <SelectTrigger className="h-8" data-testid="select-filter-operator">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="eq">Equals (=)</SelectItem>
                             <SelectItem value="neq">Not Equals (!=)</SelectItem>
                             <SelectItem value="gt">Greater ({'>'})</SelectItem>
                             <SelectItem value="gte">Greater or Equal ({'>'}=)</SelectItem>
                             <SelectItem value="lt">Less ({'<'})</SelectItem>
                             <SelectItem value="lte">Less or Equal ({'<'}=)</SelectItem>
                             <SelectItem value="contains">Contains</SelectItem>
                             <SelectItem value="isin">Is In (multi-select)</SelectItem>
                             <SelectItem value="notin">Not In (multi-select)</SelectItem>
                             <SelectItem value="isnull">Is Null</SelectItem>
                             <SelectItem value="notnull">Not Null</SelectItem>
                           </SelectContent>
                         </Select>
                      </div>
                      
                      {/* Multi-select for isin/notin operators */}
                      {(selectedNode.data.filterOp === 'isin' || selectedNode.data.filterOp === 'notin') && (
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            Values
                            {columnValuesLoading && <span className="text-[10px] text-muted-foreground">(loading...)</span>}
                            {columnValues?.isCategorical && <span className="text-[10px] text-green-600">(categorical)</span>}
                          </Label>
                          {columnValues && columnValues.values.length > 0 ? (
                            <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1 bg-white">
                              {columnValues.values.map((val) => (
                                <div key={val} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`filter-val-${val}`}
                                    checked={(selectedNode.data.filterValues || []).includes(val)}
                                    onCheckedChange={(checked) => {
                                      const currentVals = selectedNode.data.filterValues || [];
                                      if (checked) {
                                        updateNodeData('filterValues', [...currentVals, val]);
                                      } else {
                                        updateNodeData('filterValues', currentVals.filter((v: string) => v !== val));
                                      }
                                    }}
                                    data-testid={`checkbox-filter-value-${val}`}
                                  />
                                  <label
                                    htmlFor={`filter-val-${val}`}
                                    className="text-xs font-mono cursor-pointer flex-1 truncate"
                                  >
                                    {val}
                                  </label>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <Input 
                              placeholder="Enter comma-separated values" 
                              className="h-8 text-xs"
                              value={(selectedNode.data.filterValues || []).join(', ')}
                              onChange={(e) => {
                                const vals = e.target.value.split(',').map(v => v.trim()).filter(v => v);
                                updateNodeData('filterValues', vals);
                              }}
                              data-testid="input-filter-values"
                            />
                          )}
                          {(selectedNode.data.filterValues || []).length > 0 && (
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>{(selectedNode.data.filterValues || []).length} value(s) selected</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 text-[10px] px-2"
                                onClick={() => updateNodeData('filterValues', [])}
                              >
                                Clear
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Single value input for other operators */}
                      {selectedNode.data.filterOp !== 'isin' && 
                       selectedNode.data.filterOp !== 'notin' && 
                       selectedNode.data.filterOp !== 'isnull' && 
                       selectedNode.data.filterOp !== 'notnull' && (
                        <div className="space-y-2">
                          <Label>Value</Label>
                          {columnValues?.isCategorical && columnValues.values.length > 0 && 
                           (selectedNode.data.filterOp === 'eq' || selectedNode.data.filterOp === 'neq') ? (
                            <Select 
                              value={selectedNode.data.filterValue || ''} 
                              onValueChange={(val) => updateNodeData('filterValue', val)}
                            >
                              <SelectTrigger className="h-8 font-mono text-xs" data-testid="select-filter-value">
                                <SelectValue placeholder="Select value..." />
                              </SelectTrigger>
                              <SelectContent>
                                {columnValues.values.map(val => (
                                  <SelectItem key={val} value={val} className="font-mono text-xs">{val}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input 
                              placeholder="Value" 
                              className="h-8 text-xs"
                              value={selectedNode.data.filterValue || ''}
                              onChange={(e) => updateNodeData('filterValue', e.target.value)}
                              data-testid="input-filter-value"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

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

                  {selectedNode.data.type === 'aggregation' && (
                    <div className="space-y-4 border rounded-md p-3 bg-yellow-50/50 border-yellow-100">
                      <div className="space-y-2">
                        <Label>Group By Columns</Label>
                        <ColumnMultiSelect
                          label="Group by"
                          selectedCols={selectedNode.data.groupByColumns || []}
                          availableCols={getSourceColumns(selectedNode.id)}
                          onChange={(cols) => updateNodeData('groupByColumns', cols)}
                          testId="select-groupby-columns"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Value Columns</Label>
                        <ColumnMultiSelect
                          label="Values"
                          selectedCols={selectedNode.data.aggValueColumns || []}
                          availableCols={getSourceColumns(selectedNode.id)}
                          onChange={(cols) => updateNodeData('aggValueColumns', cols)}
                          testId="select-agg-value-columns"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Aggregation Function</Label>
                        <Select
                          value={selectedNode.data.aggFunction || 'sum'}
                          onValueChange={(val) => updateNodeData('aggFunction', val)}
                        >
                          <SelectTrigger className="h-8 text-xs" data-testid="select-agg-function">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sum">Sum</SelectItem>
                            <SelectItem value="mean">Mean / Average</SelectItem>
                            <SelectItem value="median">Median</SelectItem>
                            <SelectItem value="min">Minimum</SelectItem>
                            <SelectItem value="max">Maximum</SelectItem>
                            <SelectItem value="count">Count</SelectItem>
                            <SelectItem value="first">First</SelectItem>
                            <SelectItem value="last">Last</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="text-[10px] text-yellow-700 bg-yellow-100/50 p-2 rounded">
                        Groups data by selected columns and computes aggregate values. Useful for rolling up daily data to weekly/monthly.
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
                          {explorationPreview && (
                            <div className="border border-emerald-200 rounded-md bg-white p-2 overflow-hidden" data-testid="chart-preview-container">
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

      {/* Full Screen Dialog for Model Config */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 flex flex-col overflow-hidden">
           <div className="p-6 border-b shrink-0 flex items-center justify-between">
              <div>
                 <DialogTitle className="text-xl">Model Configuration</DialogTitle>
                 <DialogDescription>Setup your forecasting parameters.</DialogDescription>
              </div>
           </div>
           <ScrollArea className="flex-1 p-6 bg-slate-50/50">
              <ConfigurationPanel />
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
              <ForecastResultsDashboard />
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