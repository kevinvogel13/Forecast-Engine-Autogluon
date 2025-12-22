import { useCallback, useState, useRef } from 'react';
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
  Panel
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

const initialNodes = [
  { id: '1', position: { x: 100, y: 100 }, data: { label: 'Sales_Data_2023.csv' }, type: 'input', className: 'border-2 border-blue-200 bg-white min-w-[180px]' },
  { id: '2', position: { x: 100, y: 250 }, data: { label: 'Sales_Data_2024.csv' }, type: 'input', className: 'border-2 border-blue-200 bg-white min-w-[180px]' },
  { id: '3', position: { x: 450, y: 175 }, data: { label: 'Merge: Date & SKU' }, className: 'border-2 border-orange-200 bg-orange-50 min-w-[150px]' },
  { id: '4', position: { x: 700, y: 175 }, data: { label: 'Filter: Valid Regions' }, className: 'border-2 border-purple-200 bg-purple-50 min-w-[150px]' },
  { id: '5', position: { x: 950, y: 175 }, data: { label: 'Forecast Model' }, type: 'output', className: 'border-2 border-green-200 bg-green-50 min-w-[150px] font-bold' },
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
      const className = event.dataTransfer.getData('application/reactflow/className');

      // check if the dropped element is valid
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: getId(),
        type,
        position,
        data: { label: label },
        className: className,
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
    // Update node label to filename if it's currently generic
    if (selectedNode.data.label === 'Data Source' || selectedNode.data.label === 'CSV Source') {
      updateNodeLabel(fileName);
    }
  };

  const loadPipeline = (pipelineId: string) => {
    // Mock loading logic - in real app would fetch from API
    setLoadDialogOpen(false);
    // Just shake the screen or toast to simulate loading for now since we don't have real backend persistence for these mocked pipelines
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
          fitView
          attributionPosition="bottom-left"
        >
          <Controls className="bg-white border-border shadow-sm" />
          <MiniMap className="border border-border shadow-sm rounded-lg overflow-hidden" zoomable pannable />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#cbd5e1" />
          
          {selectedNode && (
            <Panel position="top-right" className="m-0 mt-16 mr-4">
              <Card className="w-80 shadow-xl border-border/50 backdrop-blur-sm bg-white/95 max-h-[80vh] overflow-y-auto">
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
                  
                  {(selectedNode.type === 'input') && (
                     <div className="space-y-2">
                        <Label>Data Source</Label>
                        <FileDropzone compact onUploadComplete={handleFileUpload} />
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