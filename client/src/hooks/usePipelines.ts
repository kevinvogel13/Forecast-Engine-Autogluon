import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { InsertPipeline } from '@shared/schema';
import { toast } from 'sonner';

export function usePipelines() {
  return useQuery({
    queryKey: ['pipelines'],
    queryFn: api.fetchPipelines,
  });
}

export function usePipeline(id: string) {
  return useQuery({
    queryKey: ['pipelines', id],
    queryFn: () => api.fetchPipeline(id),
    enabled: !!id,
  });
}

export function useCreatePipeline() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.createPipeline,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline saved successfully');
    },
    onError: (error) => {
      toast.error('Failed to save pipeline');
      console.error('Error creating pipeline:', error);
    },
  });
}

export function useUpdatePipeline() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertPipeline> }) =>
      api.updatePipeline(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      queryClient.invalidateQueries({ queryKey: ['pipelines', variables.id] });
      toast.success('Pipeline updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update pipeline');
      console.error('Error updating pipeline:', error);
    },
  });
}

export function useDeletePipeline() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.deletePipeline,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete pipeline');
      console.error('Error deleting pipeline:', error);
    },
  });
}

export function useExecutePipeline() {
  return useMutation({
    mutationFn: api.executePipeline,
    onSuccess: () => {
      toast.success('Pipeline executed successfully');
    },
    onError: (error) => {
      toast.error('Failed to execute pipeline');
      console.error('Error executing pipeline:', error);
    },
  });
}
