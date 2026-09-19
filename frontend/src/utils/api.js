const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function getComputeBackends() {
  const res = await fetch(`${API_BASE_URL}/api/compute`);
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function createJob(videoFile, telemetryFile, model, computeBackend, targetFps, enableMasking) {
  const formData = new FormData();
  formData.append('video', videoFile);
  if (telemetryFile) {
    formData.append('telemetry', telemetryFile);
  }
  formData.append('model', model);
  formData.append('compute_backend', computeBackend);
  formData.append('target_fps', targetFps);
  formData.append('enable_masking', enableMasking);

  const res = await fetch(`${API_BASE_URL}/api/jobs/create`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function getJobStatus(jobId) {
  const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`);
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export function getArtifactUrl(jobId, artifactName) {
  return `${API_BASE_URL}/api/jobs/${jobId}/artifact/${artifactName}`;
}
