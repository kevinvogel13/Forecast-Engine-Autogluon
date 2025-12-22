import Shell from '@/components/layout/Shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Download, Presentation } from 'lucide-react';

export default function ForecastResult() {
  return (
    <Shell>
      <div className="max-w-4xl mx-auto py-12 text-center space-y-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-4 animate-in zoom-in duration-500">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Dataset Approved</h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Your data has been validated and the forecasting model has been successfully queued for processing.
          </p>
        </div>

        <div className="flex justify-center text-left max-w-3xl mx-auto">
           <Card className="hover:border-primary/50 transition-colors cursor-pointer group w-full max-w-md">
              <CardHeader>
                 <CardTitle className="flex items-center gap-2 group-hover:text-primary transition-colors">
                    <Presentation className="w-5 h-5" /> Executive Summary
                 </CardTitle>
                 <CardDescription>
                    Generate a high-level PDF report of the input data quality and preliminary trends.
                 </CardDescription>
              </CardHeader>
              <CardContent>
                 <Button variant="secondary" className="w-full">Generate Report <Download className="w-4 h-4 ml-2" /></Button>
              </CardContent>
           </Card>
        </div>
        
        <div className="pt-8 border-t border-border mt-8">
           <p className="text-sm text-muted-foreground mb-4">What happens next?</p>
           <div className="flex items-center justify-center gap-8 text-sm text-foreground">
              <div className="flex items-center gap-2 opacity-50">
                 <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">1</span>
                 Data Import
              </div>
              <div className="w-8 h-px bg-border"></div>
              <div className="flex items-center gap-2 opacity-50">
                 <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">2</span>
                 Validation
              </div>
              <div className="w-8 h-px bg-border"></div>
              <div className="flex items-center gap-2 font-medium text-primary">
                 <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                 Model Processing
              </div>
              <div className="w-8 h-px bg-border"></div>
              <div className="flex items-center gap-2 opacity-50">
                 <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">4</span>
                 Review
              </div>
           </div>
        </div>
      </div>
    </Shell>
  );
}