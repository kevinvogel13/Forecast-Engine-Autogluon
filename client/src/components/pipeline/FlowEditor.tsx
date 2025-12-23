import { useCallback, useState, useRef, useMemo } from 'react';
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
import { Play, Settings2, Trash2, X, FolderOpen, Save, BarChart3, Database, FileText, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import FileDropzone from '@/components/file-upload/FileDropzone';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import PipelineNode from './PipelineNode';
import EDADashboard from '@/components/dashboard/EDADashboard';
import ConfigurationPanel from '@/components/configuration/ConfigurationPanel';
import ForecastResultsDashboard from '@/components/dashboard/ForecastResultsDashboard';
import NodePalette from './NodePalette';
import { toast } from 'sonner';

// Define custom node types
const nodeTypes: NodeTypes = {
  custom: PipelineNode,
};

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import Editor from '@monaco-editor/react';
import { usePipelines, useCreatePipeline, useUpdatePipeline, useExecutePipeline } from '@/hooks/usePipelines';

const initialNodes = [
  { 
    id: '1', 
    position: { x: 100, y: 100 }, 
    data: { 
      label: 'Sales_Data_2023.csv', 
      type: 'input',
      status: 'success',
      stats: { rows: 45200, cols: 12, volume: '2.1M' }
    }, 
    type: 'custom'
  },
  { 
    id: '2', 
    position: { x: 100, y: 350 }, 
    data: { 
      label: 'Sales_Data_2024.csv', 
      type: 'input',
      status: 'success',
      stats: { rows: 12400, cols: 12, volume: '0.8M' }
    }, 
    type: 'custom' 
  },
  { 
    id: '3', 
    position: { x: 450, y: 225 }, 
    data: { 
      label: 'Merge: Date & SKU', 
      type: 'merge',
      status: 'pending',
      stats: { rows: 57600, cols: 12, volume: '2.9M' }
    }, 
    type: 'custom'
  },
  { 
    id: '4', 
    position: { x: 800, y: 225 }, 
    data: { 
      label: 'Data Validation & EDA', 
      type: 'eda',
      status: 'pending',
      stats: { rows: 55100, cols: 12, volume: '2.85M' }
    }, 
    type: 'custom' 
  },
  { 
    id: '5', 
    position: { x: 1150, y: 225 }, 
    data: { 
      label: 'Model Configuration', 
      type: 'config',
      status: 'pending',
      stats: { rows: 55100, cols: 12 }
    }, 
    type: 'custom' 
  },
  { 
    id: '6', 
    position: { x: 1500, y: 225 }, 
    data: { 
      label: 'Forecast Output', 
      type: 'output',
      status: 'pending',
      stats: { rows: 55100, cols: 14 } // +2 cols for forecast
    }, 
    type: 'custom' 
  },
];

const initialEdges = [
  { id: 'e1-3', source: '1', target: '3', style: { stroke: '#94a3b8' } },
  { id: 'e2-3', source: '2', target: '3', style: { stroke: '#94a3b8' } },
  { id: 'e3-4', source: '3', target: '4', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#94a3b8' } },
  { id: 'e4-5', source: '4', target: '5', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#94a3b8' } },
  { id: 'e5-6', source: '5', target: '6', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#94a3b8' } },
];


let id = 10;
const getId = () => `${id++}`;

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
  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline();
  const executePipeline = useExecutePipeline();
  
  // Edge click popover state
  const [selectedEdgeData, setSelectedEdgeData] = useState<{ id: string, x: number, y: number, sourceNode: any, targetNode: any } | null>(null);
  
  // Modal states for full views
  const [edaOpen, setEdaOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

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

    if (currentPipelineId) {
      updatePipeline.mutate({
        id: currentPipelineId,
        data: pipelineData,
      }, {
        onSuccess: () => {
          setSaveDialogOpen(false);
        },
      });
    } else {
      createPipeline.mutate(pipelineData, {
        onSuccess: (newPipeline) => {
          setCurrentPipelineId(newPipeline.id);
          setSaveDialogOpen(false);
        },
      });
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

  return (
    <div className="flex h-full w-full border border-border rounded-xl bg-slate-50 overflow-hidden shadow-inner relative">
      <div className="flex-1 relative h-full" ref={reactFlowWrapper}>
        <div className="absolute top-4 right-4 z-10 flex gap-2">
           <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="bg-white/80 backdrop-blur gap-2">
                 <FolderOpen className="w-4 h-4" /> Load
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Load Pipeline</DialogTitle>
                <DialogDescription>
                  Select a saved pipeline configuration to load.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[300px] mt-4 pr-4">
                 <div className="space-y-2">
                    {pipelinesLoading ? (
                      <div className="text-center py-4 text-muted-foreground">Loading pipelines...</div>
                    ) : savedPipelines.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">No saved pipelines</div>
                    ) : (
                      savedPipelines.map((pipeline) => (
                       <button
                          key={pipeline.id}
                          className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent hover:border-primary/50 transition-all group"
                          onClick={() => loadPipeline(pipeline)}
                          data-testid={`button-load-pipeline-${pipeline.id}`}
                       >
                          <div className="flex items-center justify-between mb-1">
                             <span className="font-medium group-hover:text-primary transition-colors">{pipeline.name}</span>
                             <span className="text-xs text-muted-foreground">{new Date(pipeline.updatedAt).toLocaleDateString()}</span>
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
          
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="bg-white/80 backdrop-blur gap-2" data-testid="button-save-pipeline">
                <Save className="w-4 h-4" /> Save
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{currentPipelineId ? 'Update Pipeline' : 'Save Pipeline'}</DialogTitle>
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
                  <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSavePipeline} data-testid="button-confirm-save">
                    {currentPipelineId ? 'Update' : 'Save'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button 
            size="sm" 
            className={`gap-2 shadow-lg hover:shadow-xl transition-all ${isRunning ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
            onClick={runPipeline}
            disabled={isRunning}
          >
            {isRunning ? <span className="animate-spin">⟳</span> : <Play className="w-4 h-4" />} 
            {isRunning ? 'Running...' : 'Run Pipeline'}
          </Button>
        </div>
        
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
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
                               <SelectItem value="sql">SQL Query</SelectItem>
                             </SelectContent>
                           </Select>
                        </div>
                        
                        {(selectedNode.data.sourceType === 'sql') ? (
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
                                 <div className="h-32 border rounded-md overflow-hidden">
                                    <Editor
                                       height="100%"
                                       defaultLanguage="sql"
                                       defaultValue={selectedNode.data.sqlQuery || "SELECT * FROM sales_data\nWHERE date >= '2024-01-01'\nORDER BY date"}
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

                  {selectedNode.data.type === 'eda' && (
                    <div className="space-y-4 border rounded-md p-4 bg-blue-50/50 border-blue-100">
                       <div className="flex flex-col items-center justify-center text-center space-y-3 py-2">
                          <div className="bg-blue-100 p-3 rounded-full">
                             <BarChart3 className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                             <h4 className="text-sm font-semibold text-blue-900">Data Validation</h4>
                             <p className="text-xs text-blue-700 mt-1">Validate data quality, check for anomalies, and explore distributions. Data passes through unchanged if validation succeeds.</p>
                          </div>
                          <div className="w-full space-y-2 text-left">
                             <div className="flex items-center gap-2 text-xs bg-white/70 rounded p-2 border border-blue-100">
                                <Database className="w-4 h-4 text-blue-500" />
                                <span className="text-blue-800">Pass-through: Input data flows to connected nodes</span>
                             </div>
                          </div>
                          <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => setEdaOpen(true)} data-testid="button-open-eda">
                             Open EDA Dashboard
                          </Button>
                       </div>
                    </div>
                  )}

                  {selectedNode.data.type === 'config' && (
                    <div className="space-y-4 border rounded-md p-4 bg-purple-50/50 border-purple-100">
                       <div className="flex flex-col items-center justify-center text-center space-y-3 py-2">
                          <div className="bg-purple-100 p-3 rounded-full">
                             <Settings2 className="w-6 h-6 text-purple-600" />
                          </div>
                          <div>
                             <h4 className="text-sm font-semibold text-purple-900">Model Configuration</h4>
                             <p className="text-xs text-purple-700 mt-1">Configure forecasting models, hyperparameters, and feature engineering.</p>
                          </div>
                          <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => setConfigOpen(true)}>
                             Configure Pipeline
                          </Button>
                       </div>
                    </div>
                  )}

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
                          <SelectTrigger className="h-8">
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
                        <Label>Left Key</Label>
                        <Input 
                           placeholder="e.g. date, sku_id" 
                           className="h-8 font-mono text-xs" 
                           value={selectedNode.data.leftKey || ''}
                           onChange={(e) => updateNodeData('leftKey', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Right Key</Label>
                        <Input 
                           placeholder="e.g. date, item_id" 
                           className="h-8 font-mono text-xs" 
                           value={selectedNode.data.rightKey || ''}
                           onChange={(e) => updateNodeData('rightKey', e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {selectedNode.data.type === 'filter' && (
                    <div className="space-y-4 border rounded-md p-3 bg-muted/20">
                      <div className="space-y-2">
                        <Label>Column</Label>
                        <Input 
                           placeholder="Column name" 
                           className="h-8 font-mono text-xs"
                           value={selectedNode.data.filterColumn || ''}
                           onChange={(e) => updateNodeData('filterColumn', e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                         <div className="space-y-2">
                           <Label>Operator</Label>
                           <Select 
                              value={selectedNode.data.filterOp || 'eq'} 
                              onValueChange={(val) => updateNodeData('filterOp', val)}
                           >
                             <SelectTrigger className="h-8">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="eq">Equals (=)</SelectItem>
                               <SelectItem value="gt">Greater ({'>'})</SelectItem>
                               <SelectItem value="lt">Less ({'<'})</SelectItem>
                               <SelectItem value="contains">Contains</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                         <div className="space-y-2">
                           <Label>Value</Label>
                           <Input 
                              placeholder="Value" 
                              className="h-8 text-xs"
                              value={selectedNode.data.filterValue || ''}
                              onChange={(e) => updateNodeData('filterValue', e.target.value)}
                           />
                         </div>
                      </div>
                    </div>
                  )}

                  {selectedNode.data.type === 'python' && (
                    <div className="space-y-2 border rounded-md p-3 bg-muted/20">
                       <Label className="flex justify-between">
                          <span>Python Code</span>
                          <span className="text-[10px] text-muted-foreground font-mono">pandas available as pd</span>
                       </Label>
                       <div className="h-48 border rounded-md overflow-hidden">
                          <Editor
                             height="100%"
                             defaultLanguage="python"
                             defaultValue={selectedNode.data.code || "# Write your transformation here\n# df = input_df.copy()\n# df['new_col'] = df['val'] * 2\n# return df"}
                             theme="light"
                             options={{ minimap: { enabled: false }, fontSize: 11, lineNumbers: 'off' }}
                             onChange={(val) => updateNodeData('code', val)}
                          />
                       </div>
                    </div>
                  )}

                  {selectedNode.data.type === 'sql' && (
                    <div className="space-y-2 border rounded-md p-3 bg-muted/20">
                       <Label className="flex justify-between">
                          <span>SQL Query</span>
                          <span className="text-[10px] text-muted-foreground font-mono">DuckDB Dialect</span>
                       </Label>
                       <div className="h-48 border rounded-md overflow-hidden">
                          <Editor
                             height="100%"
                             defaultLanguage="sql"
                             defaultValue={selectedNode.data.query || "SELECT * FROM input_table\nWHERE region = 'US'\nLIMIT 100"}
                             theme="light"
                             options={{ minimap: { enabled: false }, fontSize: 11, lineNumbers: 'off' }}
                             onChange={(val) => updateNodeData('query', val)}
                          />
                       </div>
                    </div>
                  )}

                  {selectedNode.data.type === 'groupby' && (
                    <div className="space-y-4 border rounded-md p-3 bg-muted/20">
                      <div className="space-y-2">
                         <Label>Group Columns</Label>
                         <Input 
                            placeholder="col1, col2" 
                            className="h-8 font-mono text-xs"
                            value={selectedNode.data.groupCols || ''}
                            onChange={(e) => updateNodeData('groupCols', e.target.value)}
                         />
                      </div>
                      <div className="space-y-2">
                         <Label>Aggregations (JSON)</Label>
                         <Textarea 
                            placeholder='{"sales": "sum", "qty": "mean"}' 
                            className="font-mono text-xs h-20"
                            value={selectedNode.data.aggs || ''}
                            onChange={(e) => updateNodeData('aggs', e.target.value)}
                         />
                      </div>
                    </div>
                  )}

                  {selectedNode.data.stats && (
                     <div className="space-y-2 pt-2">
                        <Label>Metadata</Label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                           <div className="p-2 bg-muted/50 rounded border">
                              <span className="text-muted-foreground block mb-0.5">Rows</span>
                              <span className="font-mono font-medium">{selectedNode.data.stats.rows.toLocaleString()}</span>
                           </div>
                           <div className="p-2 bg-muted/50 rounded border">
                              <span className="text-muted-foreground block mb-0.5">Columns</span>
                              <span className="font-mono font-medium">{selectedNode.data.stats.cols}</span>
                           </div>
                           <div className="p-2 bg-muted/50 rounded border col-span-2">
                              <span className="text-muted-foreground block mb-0.5">Total Volume</span>
                              <span className="font-mono font-medium text-primary">{selectedNode.data.stats.volume || 'N/A'}</span>
                           </div>
                        </div>
                     </div>
                  )}

                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">ID: {selectedNode.id}</span>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={deleteSelectedNode}
                      className="h-8 px-2"
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Delete
                    </Button>
                  </div>
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
                            <span className="text-muted-foreground">Source:</span>
                            <span className="font-mono">{selectedEdgeData.sourceNode?.data.label}</span>
                         </div>
                         <div className="flex justify-between">
                            <span className="text-muted-foreground">Target:</span>
                            <span className="font-mono">{selectedEdgeData.targetNode?.data.label}</span>
                         </div>
                         <Separator className="my-1 bg-blue-200" />
                         <div className="flex justify-between font-semibold">
                            <span>Row Count:</span>
                            <span>{selectedEdgeData.sourceNode?.data.stats?.rows?.toLocaleString() || 'N/A'}</span>
                         </div>
                         <div className="flex justify-between text-muted-foreground">
                            <span>Status:</span>
                            <span className="capitalize">{selectedEdgeData.sourceNode?.data.status}</span>
                         </div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 w-full mt-2 text-[10px] text-blue-600 hover:text-blue-800 hover:bg-blue-100" onClick={() => setSelectedEdgeData(null)}>Close</Button>
                   </CardContent>
                </Card>
             </Panel>
          )}

          <NodePalette onDragStart={onNodeDragStart} />

        </ReactFlow>
      </div>

      {/* Full Screen Dialogs for EDA and Config */}
      <Dialog open={edaOpen} onOpenChange={setEdaOpen}>
        <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 flex flex-col overflow-hidden">
           <div className="p-6 border-b shrink-0 flex items-center justify-between">
              <div>
                 <DialogTitle className="text-xl">Data Validation & EDA</DialogTitle>
                 <DialogDescription>Interactive exploratory data analysis.</DialogDescription>
              </div>
           </div>
           <ScrollArea className="flex-1 p-6 bg-slate-50/50">
              <EDADashboard />
           </ScrollArea>
        </DialogContent>
      </Dialog>

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