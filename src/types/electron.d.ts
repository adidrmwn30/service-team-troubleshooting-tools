export interface ElectronAPI {
  getCallQualitySession?: () => Promise<{ active: boolean; maskedToken?: string; secureStorageAvailable?: boolean }>;
  getScTicketSession?: () => Promise<{ active: boolean; maskedToken?: string; secureStorageAvailable?: boolean }>;
  fetchB3SiemEvents?: (txnUuid: string) => Promise<{ success: boolean; data?: any; maskedToken?: string; requiresAuth?: boolean; error?: string }>;
  saveCallQualitySession?: (rawCurlOrToken: string) => Promise<{ success: boolean; maskedToken?: string; secureStorageAvailable?: boolean; error?: string }>;
  clearCallQualitySession?: () => Promise<{ success: boolean }>;
  openB3LoginWindow?: () => Promise<{ success: boolean; cancelled?: boolean; maskedToken?: string; error?: string; session?: { maskedToken?: string } }>;
  openExternalUrl?: (url: string) => Promise<void>;
  createGlobalpingMeasurement?: (payload: {
    type: string;
    target: string;
    limit?: number;
    locations?: Array<{ country?: string; continent?: string; city?: string; asn?: number }>;
    measurementOptions?: Record<string, any>;
  }) => Promise<{
    success: boolean;
    id?: string;
    status?: string;
    error?: string;
    isRateLimited?: boolean;
    rateLimitRemaining?: number;
  }>;
  getGlobalpingMeasurement?: (id: string) => Promise<{
    success: boolean;
    data?: any;
    error?: string;
    isRateLimited?: boolean;
    rateLimitRemaining?: number;
  }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
