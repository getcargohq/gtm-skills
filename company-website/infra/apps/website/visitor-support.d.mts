export interface BrowserVisitors {
  enabled: boolean;
  siteUrl: string;
  privacyPolicyUrl: string;
  approvedScriptSha256: string;
}
export const disabledVisitors: BrowserVisitors;
export function sha256(value: string): string;
export function readBrowserVisitors(root: string): BrowserVisitors;
export function httpsSite(value: string): URL;
export function validateBrowserVisitors(root: string): BrowserVisitors;
export function assertVisitorBinding(
  root: string,
  visitors?: {
    enabled: boolean;
    siteUrl: string;
    connectorUuid: string;
    snitcherWorkspaceUuid: string;
  },
): void;
export interface VisitorConsentConfig {
  enabled: true;
  siteUrl: string;
  privacyPolicyUrl: string;
}
export function visitorConsentConfig(root: string): VisitorConsentConfig | null;
