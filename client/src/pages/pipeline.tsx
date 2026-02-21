import Shell from '@/components/layout/Shell';
import FlowEditor from '@/components/pipeline/FlowEditor';

export default function Pipeline() {
  return (
    <Shell fullBleed>
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col">
           <FlowEditor />
        </div>
      </div>
    </Shell>
  );
}
