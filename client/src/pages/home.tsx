import Shell from '@/components/layout/Shell';
import FileDropzone from '@/components/file-upload/FileDropzone';

export default function Home() {
  return (
    <Shell>
      <div className="max-w-4xl mx-auto py-12">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl mb-4">
            Data Forecasting Pipeline
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Connect disparate data sources, define join logic, and generate accurate forecasts with visual validation.
          </p>
        </div>
        
        <FileDropzone />
      </div>
    </Shell>
  );
}