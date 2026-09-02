export interface AgentIdenticonModel {
  paletteIndex: number;
  spokes: number;
  rotation: number;
  orbitRadius: number;
  nodeRadius: number;
  innerRadius: number;
  dash: number;
}

export function createAgentIdenticonModel(did: string): AgentIdenticonModel;
export function renderAgentIdenticon(target: Element, did: string): boolean;
export function syncAgentIdenticon(): boolean;
