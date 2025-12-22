import Shell from '@/components/layout/Shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Save, Bell, Database, Shield, User, Sliders, Cpu, Activity } from 'lucide-react';

export default function Settings() {
  return (
    <Shell>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configuration</h2>
          <p className="text-muted-foreground">Advanced control over AutoGluon forecasting parameters and system behavior.</p>
        </div>

        <Tabs defaultValue="models" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="models">Model Specs</TabsTrigger>
            <TabsTrigger value="training">Training Strategy</TabsTrigger>
            <TabsTrigger value="hyperparameters">Hyperparameters</TabsTrigger>
            <TabsTrigger value="general">System & Profile</TabsTrigger>
          </TabsList>

          {/* --- MODEL SPECS TAB --- */}
          <TabsContent value="models" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Card className="md:col-span-2">
                 <CardHeader>
                   <div className="flex items-center gap-2">
                     <Database className="w-5 h-5 text-primary" />
                     <CardTitle>Global Predictor Settings</CardTitle>
                   </div>
                   <CardDescription>Core parameters for the <code>TimeSeriesPredictor</code> initialization.</CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="space-y-2">
                          <Label>Prediction Length (Horizon)</Label>
                          <Input type="number" defaultValue="12" />
                          <p className="text-[10px] text-muted-foreground">Number of time steps to forecast.</p>
                       </div>
                       <div className="space-y-2">
                          <Label>Evaluation Metric</Label>
                          <Select defaultValue="MASE">
                             <SelectTrigger>
                                <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                                <SelectItem value="MASE">MASE (Mean Absolute Scaled Error)</SelectItem>
                                <SelectItem value="MAPE">MAPE (Mean Absolute Percentage Error)</SelectItem>
                                <SelectItem value="RMSE">RMSE (Root Mean Squared Error)</SelectItem>
                                <SelectItem value="WQL">WQL (Weighted Quantile Loss)</SelectItem>
                             </SelectContent>
                          </Select>
                          <p className="text-[10px] text-muted-foreground">Primary metric for optimizing models.</p>
                       </div>
                       <div className="space-y-2">
                          <Label>Quantile Levels</Label>
                          <Input defaultValue="0.1, 0.5, 0.9" placeholder="e.g. 0.1, 0.5, 0.9" />
                          <p className="text-[10px] text-muted-foreground">Probabilistic forecast intervals (comma separated).</p>
                       </div>
                    </div>
                 </CardContent>
               </Card>

               <Card>
                 <CardHeader>
                   <div className="flex items-center gap-2">
                     <Activity className="w-5 h-5 text-primary" />
                     <CardTitle>Quality Presets</CardTitle>
                   </div>
                   <CardDescription>High-level configuration for model complexity.</CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-4">
                    <div className="space-y-2">
                       <Label>Preset Configuration</Label>
                       <Select defaultValue="medium_quality">
                          <SelectTrigger>
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="fast_training">Fast Training (Statistical + Trees)</SelectItem>
                             <SelectItem value="medium_quality">Medium Quality (Balanced)</SelectItem>
                             <SelectItem value="high_quality">High Quality (Deep Learning)</SelectItem>
                             <SelectItem value="best_quality">Best Quality (Intensive HPO)</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label>Time Limit (Seconds)</Label>
                       <Input type="number" defaultValue="600" />
                       <p className="text-[10px] text-muted-foreground">Max wall-clock time for training.</p>
                    </div>
                 </CardContent>
               </Card>

               <Card>
                 <CardHeader>
                   <div className="flex items-center gap-2">
                     <Cpu className="w-5 h-5 text-primary" />
                     <CardTitle>Covariates</CardTitle>
                   </div>
                   <CardDescription>External features known in advance.</CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-4">
                    <div className="space-y-2">
                       <Label>Known Covariates</Label>
                       <Textarea placeholder="e.g. ['holiday', 'promotion_flag']" className="font-mono text-xs" rows={4} />
                       <p className="text-[10px] text-muted-foreground">JSON list of column names in your dataset.</p>
                    </div>
                 </CardContent>
               </Card>
            </div>
          </TabsContent>

          {/* --- TRAINING STRATEGY TAB --- */}
          <TabsContent value="training" className="space-y-6">
             <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-primary" />
                  <CardTitle>Validation Strategy</CardTitle>
                </div>
                <CardDescription>Configure backtesting windows and refitting logic.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-4">
                      <div className="space-y-2">
                         <Label>Number of Validation Windows</Label>
                         <Input type="number" defaultValue="1" />
                         <p className="text-[10px] text-muted-foreground">Number of backtesting folds. Higher = better estimate, slower training.</p>
                      </div>
                      <div className="space-y-2">
                         <Label>Refit Every N Windows</Label>
                         <Input type="number" defaultValue="1" />
                      </div>
                   </div>
                   <div className="space-y-4">
                      <div className="flex items-center justify-between border p-3 rounded-lg">
                         <div className="space-y-0.5">
                            <Label>Refit Full</Label>
                            <p className="text-xs text-muted-foreground">Retrain best models on all data (train + val) at the end.</p>
                         </div>
                         <Switch />
                      </div>
                      <div className="flex items-center justify-between border p-3 rounded-lg">
                         <div className="space-y-0.5">
                            <Label>Enable Ensemble</Label>
                            <p className="text-xs text-muted-foreground">Build weighted ensemble of best performing models.</p>
                         </div>
                         <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between border p-3 rounded-lg">
                         <div className="space-y-0.5">
                            <Label>Skip Model Selection</Label>
                            <p className="text-xs text-muted-foreground">Skip scoring (only for single pre-trained models).</p>
                         </div>
                         <Switch />
                      </div>
                   </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                 <CardTitle>Hyperparameter Tuning (HPO)</CardTitle>
                 <CardDescription>Search strategy for finding optimal parameters.</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                       <Label>Search Strategy</Label>
                       <Select defaultValue="auto">
                          <SelectTrigger>
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="auto">Auto</SelectItem>
                             <SelectItem value="random">Random Search</SelectItem>
                             <SelectItem value="bayes">Bayesian Optimization</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label>Number of Trials</Label>
                       <Input type="number" defaultValue="5" />
                    </div>
                    <div className="space-y-2">
                       <Label>Scheduler</Label>
                       <Select defaultValue="local">
                          <SelectTrigger>
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="local">Local</SelectItem>
                             <SelectItem value="fifo">FIFO</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                 </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- HYPERPARAMETERS TAB --- */}
          <TabsContent value="hyperparameters" className="space-y-6">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 h-fit">
                   <CardHeader>
                      <CardTitle>Included Models</CardTitle>
                      <CardDescription>Select which model families to train.</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <div className="space-y-4">
                         <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deep Learning</h4>
                            <div className="flex items-center space-x-2">
                               <Checkbox id="deepar" defaultChecked />
                               <Label htmlFor="deepar" className="font-normal">DeepAR</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                               <Checkbox id="tft" defaultChecked />
                               <Label htmlFor="tft" className="font-normal">TemporalFusionTransformer</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                               <Checkbox id="chronos" />
                               <Label htmlFor="chronos" className="font-normal">Chronos (Foundation Model)</Label>
                            </div>
                         </div>
                         <Separator />
                         <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statistical</h4>
                            <div className="flex items-center space-x-2">
                               <Checkbox id="arima" defaultChecked />
                               <Label htmlFor="arima" className="font-normal">AutoARIMA</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                               <Checkbox id="ets" defaultChecked />
                               <Label htmlFor="ets" className="font-normal">AutoETS</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                               <Checkbox id="theta" defaultChecked />
                               <Label htmlFor="theta" className="font-normal">Theta</Label>
                            </div>
                         </div>
                         <Separator />
                         <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Machine Learning</h4>
                            <div className="flex items-center space-x-2">
                               <Checkbox id="rectab" defaultChecked />
                               <Label htmlFor="rectab" className="font-normal">RecursiveTabular (LightGBM)</Label>
                            </div>
                         </div>
                      </div>
                   </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                   <CardHeader>
                      <CardTitle>Advanced Configuration Object</CardTitle>
                      <CardDescription>
                         Direct JSON override for the <code>hyperparameters</code> dictionary passed to <code>fit()</code>.
                         Values defined here take precedence over UI selections.
                      </CardDescription>
                   </CardHeader>
                   <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                         <AccordionItem value="item-1">
                            <AccordionTrigger>Example Configuration</AccordionTrigger>
                            <AccordionContent>
                               <pre className="text-[10px] bg-muted p-4 rounded-md overflow-x-auto">
{`{
  "DeepAR": {
    "epochs": 50,
    "num_batches_per_epoch": 50,
    "learning_rate": 1e-3,
    "context_length": 64
  },
  "AutoARIMA": {
    "max_p": 5,
    "max_q": 5,
    "seasonal": true
  }
}`}
                               </pre>
                            </AccordionContent>
                         </AccordionItem>
                      </Accordion>
                      <div className="mt-4">
                         <Label className="mb-2 block">Custom Hyperparameters JSON</Label>
                         <Textarea 
                            className="font-mono text-xs min-h-[400px]" 
                            placeholder={`{\n  "DeepAR": {\n    "hidden_size": 40,\n    "dropout_rate": 0.1\n  }\n}`}
                         />
                      </div>
                   </CardContent>
                </Card>
             </div>
          </TabsContent>

          {/* --- GENERAL / EXISTING SETTINGS --- */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  <CardTitle>Profile Information</CardTitle>
                </div>
                <CardDescription>Update your personal details and display preferences.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" defaultValue="John Doe" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" defaultValue="john.doe@example.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select defaultValue="scientist">
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scientist">Data Scientist</SelectItem>
                      <SelectItem value="analyst">Business Analyst</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                 <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  <CardTitle>Notifications</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Pipeline Failures</Label>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Validation Warnings</Label>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border flex justify-end gap-2 z-50">
           <Button variant="outline">Discard Changes</Button>
           <Button className="gap-2 shadow-lg">
              <Save className="w-4 h-4" /> Save Configuration
           </Button>
        </div>
      </div>
    </Shell>
  );
}