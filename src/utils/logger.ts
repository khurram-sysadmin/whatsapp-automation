/**
 * EightBit Solutions Outreach Console Logger
 * Sanitizes output to prevent logging secret keys, tokens, or PII.
 */
export const Logger = {
  appMounted: () => {
    console.log('[App] mounted');
  },
  dashboardLoading: () => {
    console.log('[Dashboard] loading');
  },
  dashboardLoaded: () => {
    console.log('[Dashboard] loaded');
  },
  apiRequestAction: (action: string, metadata?: Record<string, any>) => {
    const safePayload = metadata
      ? { campaignId: metadata.campaignId, limit: metadata.limit, offset: metadata.offset }
      : {};
    console.log(`[ApiService] request action: "${action}"`, safePayload);
  },
  apiResponseStatus: (action: string, status: number, success: boolean) => {
    console.log(`[ApiService] response status: ${status} (action: "${action}", success: ${success})`);
  },
  apiRequestFailed: (action: string, error: string) => {
    console.warn(`[ApiService] request failed: action "${action}" - ${error}`);
  },
  errorBoundaryRenderError: (error: Error, errorInfo?: any) => {
    console.error('[ErrorBoundary] render failure:', error.name);
    void errorInfo;
  },
};
