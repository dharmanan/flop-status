import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { encodeBase58btc } from "../../lib/crypto/base58.js";
import { encodeBase64Url } from "../../lib/crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../../lib/crypto/canonical-json.js";
import { AgentProfileService } from "../../lib/runtime/agent-profile-service.js";

function agent() {
  const pair = generateKeyPairSync("ed25519");
  const jwk = pair.publicKey.export({ format: "jwk" }) as { x: string };
  const raw = Buffer.from(jwk.x, "base64url");
  const prefixed = new Uint8Array(34); prefixed.set([0xed,0x01],0); prefixed.set(raw,2);
  const did = `did:key:z${encodeBase58btc(prefixed)}`;
  return { did, sign(payload: unknown) { return encodeBase64Url(new Uint8Array(sign(null, Buffer.from(canonicalizeJsonToBytes(payload)), pair.privateKey))); } };
}
class Repo {
  consumed = new Set<string>();
  profiles = new Map<string, any>();
  handles = new Map<string,string>();
  async consumeActionNonce(did:string,nonce:string){const key=`${did}:${nonce}`;if(this.consumed.has(key))return false;this.consumed.add(key);return true}
  async upsertProfile(input:any){const owner=this.handles.get(input.handle);if(owner&&owner!==input.did)throw new Error("duplicate key value violates unique constraint agent_profiles_handle_key");this.handles.set(input.handle,input.did);const profile={did:input.did,displayName:input.displayName,handle:input.handle,claimedAt:input.claimedAt,updatedAt:input.claimedAt};this.profiles.set(input.did,profile);return profile}
  async getProfileByDid(did:string){return this.profiles.get(did)??null}
  async search(q:string){return [...this.profiles.values()].filter((p:any)=>p.displayName.toLowerCase().includes(q.toLowerCase())||p.handle.includes(q.toLowerCase()))}
}
function envelope(a:ReturnType<typeof agent>,name:string,handle:string,nonce=crypto.randomUUID()){
  const payload={version:"1",action:"UPSERT_AGENT_PROFILE",actor_did:a.did,nonce,issued_at:new Date().toISOString(),display_name:name,handle};
  return {payload,signature:{algorithm:"Ed25519",encoding:"base64url",value:a.sign(payload)}};
}
describe("AgentProfileService",()=>{
  it("binds a human-readable profile to the signing DID",async()=>{const repo=new Repo(),service=new AgentProfileService(repo as any),a=agent();const result=await service.upsert(envelope(a,"Atlas","atlas7k2"));expect(result.profile).toMatchObject({did:a.did,displayName:"Atlas",handle:"atlas7k2"})});
  it("rejects profile claims signed by another DID",async()=>{const repo=new Repo(),service=new AgentProfileService(repo as any),a=agent(),b=agent();const signed=envelope(a,"Atlas","atlas7k2");signed.signature.value=b.sign(signed.payload);await expect(service.upsert(signed)).rejects.toMatchObject({code:"INVALID_AGENT_PROFILE_SIGNATURE"})});
  it("rejects replayed profile claims",async()=>{const repo=new Repo(),service=new AgentProfileService(repo as any),a=agent(),signed=envelope(a,"Atlas","atlas7k2");await service.upsert(signed);await expect(service.upsert(signed)).rejects.toMatchObject({code:"AGENT_PROFILE_REPLAY"})});
  it("enforces globally unique handles",async()=>{const repo=new Repo(),service=new AgentProfileService(repo as any),a=agent(),b=agent();await service.upsert(envelope(a,"Atlas","atlas7k2"));await expect(service.upsert(envelope(b,"Other Atlas","atlas7k2"))).rejects.toMatchObject({code:"AGENT_HANDLE_TAKEN"})});
  it("allows duplicate display names when handles differ",async()=>{const repo=new Repo(),service=new AgentProfileService(repo as any),a=agent(),b=agent();await service.upsert(envelope(a,"Atlas","atlas7k2"));const second=await service.upsert(envelope(b,"Atlas","atlas9m4"));expect(second.profile.displayName).toBe("Atlas");expect(second.profile.handle).toBe("atlas9m4")});
});
