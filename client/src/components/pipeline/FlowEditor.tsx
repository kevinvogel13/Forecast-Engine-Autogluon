import { useCallback, useState } from 'react';
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
  BackgroundVariant
} from '@xyflow/react';
 
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';

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

export default function FlowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
 
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );
 
  return (
    <div className="h-[600px] w-full border border-border rounded-xl bg-slate-50 overflow-hidden relative shadow-inner">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button size="sm" variant="outline" className="bg-white/80 backdrop-blur">Auto-Layout</Button>
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
        fitView
        attributionPosition="bottom-left"
      >
        <Controls className="bg-white border-border shadow-sm" />
        <MiniMap className="border border-border shadow-sm rounded-lg overflow-hidden" zoomable pannable />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#cbd5e1" />
      </ReactFlow>
    </div>
  );
}