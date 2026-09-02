import { readFileSync } from "node:fs";
import {
  buildCertificateSocialDescription,
  capabilityShareMeta,
  certificatePublicUrl,
  rankName,
} from "../web/certificate-share.js";

const API_BASE = "https://flop-status-production.up.railway.app";
const FALLBACK_TITLE = "FLOP Certificate";
const FALLBACK_DESCRIPTION = "Public FLOP certificate. Open the proof page to inspect its current verification state.";
const CERTIFICATE_TEMPLATE = readFileSync(new URL("../web/certificate.html", import.meta.url), "utf8");
const CERTIFICATE_BODY = `<body${CERTIFICATE_TEMPLATE.split("<body")[1] ?? ""}`;

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeId(value) {
  const text = Array.isArray(value) ? value[0] : value;
  return /^[0-9a-f-]{20,64}$/i.test(String(text ?? "")) ? String(text) : "";
}

async function jsonFetch(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error(`upstream ${response.status}`);
  return response.json();
}

async function socialContext(certificateId) {
  const certificateBody = await jsonFetch(`${API_BASE}/api/v1/certificates/${encodeURIComponent(certificateId)}`);
  const certificate = certificateBody?.certificate;
  if (!certificate?.agent_did || !certificate?.capability_id) throw new Error("certificate missing");

  const [profileResult, listResult] = await Promise.allSettled([
    jsonFetch(`${API_BASE}/api/v1/agent-profiles/${encodeURIComponent(certificate.agent_did)}`),
    jsonFetch(`${API_BASE}/api/v1/agents/${encodeURIComponent(certificate.agent_did)}/certificates`),
  ]);
  const profile = profileResult.status === "fulfilled" ? profileResult.value?.profile ?? null : null;
  const list = listResult.status === "fulfilled" ? listResult.value : null;
  const meta = capabilityShareMeta(certificate.capability_id);
  const certificateCount = Number(list?.certificate_count) || 1;
  const rank = rankName(list?.rank);
  const title = `C${meta.ordinal} · ${meta.title.en} · FLOP`;
  const description = buildCertificateSocialDescription({
    capabilityId: certificate.capability_id,
    profile,
    certificateCount,
    rank,
    did: certificate.agent_did,
  });

  return {
    title,
    description,
    url: certificatePublicUrl(certificateId),
  };
}

function pageHead(meta) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${esc(meta.title)}</title>
  <meta name="description" content="${esc(meta.description)}">
  <link rel="canonical" href="${esc(meta.url)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="FLOP">
  <meta property="og:url" content="${esc(meta.url)}">
  <meta property="og:title" content="${esc(meta.title)}">
  <meta property="og:description" content="${esc(meta.description)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:site" content="@flop_labs">
  <meta name="twitter:title" content="${esc(meta.title)}">
  <meta name="twitter:description" content="${esc(meta.description)}">
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/certificate.css?v=shareable-certificates-v1">
</head>`;
}

export default async function handler(request, response) {
  const certificateId = safeId(request.query?.certificateId);
  const fallbackUrl = certificateId
    ? certificatePublicUrl(certificateId)
    : "https://flop-status.vercel.app/certificate";

  let meta = {
    title: FALLBACK_TITLE,
    description: FALLBACK_DESCRIPTION,
    url: fallbackUrl,
  };

  if (certificateId) {
    try {
      meta = await socialContext(certificateId);
    } catch {
      // Fail closed: do not emit verified metadata when public proof lookup fails.
    }
  }

  response.setHeader("content-type", "text/html; charset=utf-8");
  response.setHeader("cache-control", "public, s-maxage=60, stale-while-revalidate=300");
  response.status(200).send(pageHead(meta) + CERTIFICATE_BODY);
}
