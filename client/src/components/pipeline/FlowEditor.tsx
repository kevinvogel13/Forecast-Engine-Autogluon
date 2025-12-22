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
import { Play, Settings2, Trash2, X, FolderOpen, Save } from 'lucide-react';
import Sidebar from './Sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import FileDropzone from '@/components/file-upload/FileDropzone';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import PipelineNode from './PipelineNode';

// Define custom node types
const nodeTypes: NodeTypes = {
  custom: PipelineNode,
};

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import Editor from '@monaco-editor/react';

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
      status: 'processing',
      stats: { rows: 57600, cols: 12, volume: '2.9M' }
    }, 
    type: 'custom'
  },
  { 
    id: '4', 
    position: { x: 800, y: 225 }, 
    data: { 
      label: 'Filter: Valid Regions', 
      type: 'filter',
      status: 'pending',
      stats: { rows: 55100, cols: 12, volume: '2.85M' }
    }, 
    type: 'custom' 
  },
  { 
    id: '5', 
    position: { x: 1150, y: 225 }, 
    data: { 
      label: 'Forecast Model', 
      type: 'output',
      status: 'pending',
      stats: { rows: 55100, cols: 14 } // +2 cols for forecast
    }, 
    type: 'custom' 
  },
];

const initialEdges = [
  { id: 'e1-3', source: '1', target: '3', animated: true, style: { stroke: '#94a3b8' } },
  { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#94a3b8' } },
  { id: 'e3-4', source: '3', target: '4', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#94a3b8' } },
  { id: 'e4-5', source: '4', target: '5', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#94a3b8' } },
];

const savedPipelines = [
  { id: 'p1', name: 'Q3 Sales Forecast', description: 'Standard sales forecasting model for Q3 2024', nodes: 5, lastModified: '2024-12-20' },
  { id: 'p2', name: 'Inventory Optimization', description: 'Weekly inventory level predictions', nodes: 8, lastModified: '2024-12-18' },
  { id: 'p3', name: 'Marketing ROI Analysis', description: 'Campaign performance vs sales correlation', nodes: 4, lastModified: '2024-12-15' },
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
      // Removed className because we handle styling in the custom node now

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: getId(),
        type: 'custom', // Use our custom node renderer
        position,
        data: { 
           label: label, 
           type: type, // Pass the functional type to the node data
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

  const handleFileUpload = (fileName: string) => {
    if (!selectedNode) return;
    
    // Simulate updating stats after upload
    const mockStats = {
       rows: Math.floor(Math.random() * 50000) + 10000,
       cols: Math.floor(Math.random() * 20) + 5,
       volume: (Math.random() * 5).toFixed(1) + 'M'
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
                   stats: mockStats
                }
             };
          }
          return node;
       })
    );
    
    // Also update selected node state to reflect changes in the panel immediately
    setSelectedNode((prev: any) => ({ 
       ...prev, 
       data: { 
          ...prev.data, 
          label: fileName,
          stats: mockStats
       } 
    }));
  };

  const loadPipeline = (pipelineId: string) => {
    setLoadDialogOpen(false);
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
                    {savedPipelines.map((pipeline) => (
                       <button
                          key={pipeline.id}
                          className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent hover:border-primary/50 transition-all group"
                          onClick={() => loadPipeline(pipeline.id)}
                       >
                          <div className="flex items-center justify-between mb-1">
                             <span className="font-medium group-hover:text-primary transition-colors">{pipeline.name}</span>
                             <span className="text-xs text-muted-foreground">{pipeline.lastModified}</span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">{pipeline.description}</p>
                          <div className="mt-2 text-xs flex gap-2">
                             <span className="bg-secondary px-1.5 py-0.5 rounded">{pipeline.nodes} Nodes</span>
                          </div>
                       </button>
                    ))}
                 </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
          
          <Button size="sm" variant="outline" className="bg-white/80 backdrop-blur gap-2">
             <Save className="w-4 h-4" /> Save
          </Button>
          <Button size="sm" className="gap-2 shadow-lg hover:shadow-xl transition-all">
            <Play className="w-4 h-4" /> Run Pipeline
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
          onPaneClick={() => setSelectedNode(null)}
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
                     <div className="space-y-2">
                        <Label>Data Source</Label>
                        <FileDropzone compact onUploadComplete={handleFileUpload} />
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
        </ReactFlow>
      </div>
      <Sidebar />
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