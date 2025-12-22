import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileSpreadsheet, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export default function FileDropzone() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
    
    // Simulate upload progress
    acceptedFiles.forEach(file => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
        if (progress >= 100) clearInterval(interval);
      }, 100);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/json': ['.json']
    }
  });

  const removeFile = (name: string) => {
    setFiles(prev => prev.filter(f => f.name !== name));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[name];
      return newProgress;
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">Upload Data Sources</h2>
        <p className="text-muted-foreground">Import your historical sales data, inventory logs, or market indicators.</p>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-12 transition-all duration-200 ease-in-out cursor-pointer flex flex-col items-center justify-center gap-4 group",
          isDragActive 
            ? "border-primary bg-primary/5 ring-4 ring-primary/10" 
            : "border-border hover:border-primary/50 hover:bg-accent/50"
        )}
      >
        <input {...getInputProps()} />
        <div className={cn(
          "w-16 h-16 rounded-full bg-accent flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
          isDragActive && "bg-primary/20 text-primary scale-110"
        )}>
          <UploadCloud className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-medium text-foreground">
            {isDragActive ? "Drop files here" : "Click to upload or drag and drop"}
          </p>
          <p className="text-sm text-muted-foreground">
            CSV, Excel, or JSON (max 50MB)
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {files.map((file) => (
            <motion.div
              key={file.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-lg p-4 flex items-center gap-4 shadow-sm"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={uploadProgress[file.name] || 0} className="h-1.5" />
                  {uploadProgress[file.name] === 100 && (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); removeFile(file.name); }}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {files.length > 0 && (
        <div className="flex justify-end pt-4">
          <Button size="lg" className="w-full sm:w-auto font-medium">
            Continue to Pipeline
          </Button>
        </div>
      )}
    </div>
  );
}