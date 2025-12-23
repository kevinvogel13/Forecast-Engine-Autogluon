import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import { toast } from 'sonner';

export function useDatasets() {
  return useQuery({
    queryKey: ['datasets'],
    queryFn: api.fetchDatasets,
  });
}

export function useUploadDataset() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.uploadDataset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      toast.success('Dataset uploaded successfully');
    },
    onError: (error) => {
      toast.error('Failed to upload dataset');
      console.error('Error uploading dataset:', error);
    },
  });
}

export function useDeleteDataset() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.deleteDataset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      toast.success('Dataset deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete dataset');
      console.error('Error deleting dataset:', error);
    },
  });
}
