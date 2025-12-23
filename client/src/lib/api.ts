import type { Pipeline, Dataset, InsertPipeline } from "@shared/schema";

const API_BASE = "/api";

export async function fetchPipelines(): Promise<Pipeline[]> {
  const response = await fetch(`${API_BASE}/pipelines`);
  if (!response.ok) throw new Error("Failed to fetch pipelines");
  return response.json();
}

export async function fetchPipeline(id: string): Promise<Pipeline> {
  const response = await fetch(`${API_BASE}/pipelines/${id}`);
  if (!response.ok) throw new Error("Failed to fetch pipeline");
  return response.json();
}

export async function createPipeline(data: InsertPipeline): Promise<Pipeline> {
  const response = await fetch(`${API_BASE}/pipelines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to create pipeline");
  return response.json();
}

export async function updatePipeline(id: string, data: Partial<InsertPipeline>): Promise<Pipeline> {
  const response = await fetch(`${API_BASE}/pipelines/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to update pipeline");
  return response.json();
}

export async function deletePipeline(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/pipelines/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete pipeline");
}

export async function executePipeline(id: string): Promise<any> {
  const response = await fetch(`${API_BASE}/pipelines/${id}/execute`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to execute pipeline");
  return response.json();
}

export async function fetchDatasets(): Promise<Dataset[]> {
  const response = await fetch(`${API_BASE}/datasets`);
  if (!response.ok) throw new Error("Failed to fetch datasets");
  return response.json();
}

export async function uploadDataset(file: File): Promise<Dataset> {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetch(`${API_BASE}/datasets/upload`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error("Failed to upload dataset");
  return response.json();
}

export async function deleteDataset(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/datasets/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete dataset");
}
