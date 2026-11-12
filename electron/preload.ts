import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getCallQualitySession: () => ipcRenderer.invoke('call-quality:get-session'),
  fetchB3SiemEvents: (txnUuid: string) => ipcRenderer.invoke('call-quality:fetch-siem-events', txnUuid),
  saveCallQualitySession: (rawCurlOrToken: string) => ipcRenderer.invoke('call-quality:save-session', rawCurlOrToken),
  clearCallQualitySession: () => ipcRenderer.invoke('call-quality:clear-session'),
  openB3LoginWindow: () => ipcRenderer.invoke('call-quality:open-login-window'),
  openExternalUrl: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  createGlobalpingMeasurement: (payload: any) => ipcRenderer.invoke('globalping:create-measurement', payload),
  getGlobalpingMeasurement: (id: string) => ipcRenderer.invoke('globalping:get-measurement', id),
});
