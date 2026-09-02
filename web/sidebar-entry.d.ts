export interface SidebarLike {
  querySelector(selector: string): any;
  insertBefore(node: any, reference: any): any;
}

export interface ConnectableEntry {
  isConnected: boolean;
}

export function ensureSidebarEntry<T extends ConnectableEntry>(
  sidebar: SidebarLike,
  existingEntry: T | null,
  makeEntry: () => T,
  beforeSelectors: string[],
): T;
