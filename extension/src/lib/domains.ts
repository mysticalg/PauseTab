import type { Rule } from "./schema";

export const normalizeHost = (host: string) =>
  host.trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");

export const normalizeDomainPattern = (pattern: string) =>
  normalizeHost(pattern.replace(/^https?:\/\//, "").split("/")[0] ?? pattern);

export const getUrlObject = (value: string) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

export const getHostnameFromUrl = (value: string) => {
  const parsed = getUrlObject(value);
  return parsed ? normalizeHost(parsed.hostname) : "";
};

export const domainMatchesPattern = (hostname: string, pattern: string) => {
  const normalizedHost = normalizeHost(hostname);
  const normalizedPattern = normalizeDomainPattern(pattern);
  return normalizedHost === normalizedPattern || normalizedHost.endsWith(`.${normalizedPattern}`);
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const wildcardToRegExp = (value: string) =>
  new RegExp(`^${escapeRegExp(value).replace(/\\\*/g, ".*")}$`, "i");

export const pathMatches = (pathname: string, pathPattern?: string) => {
  if (!pathPattern) {
    return true;
  }

  if (pathPattern.includes("*")) {
    return wildcardToRegExp(pathPattern).test(pathname);
  }

  return pathname.startsWith(pathPattern);
};

export const allowlistMatches = (url: URL, rule: Rule) =>
  rule.allowlistPatterns.some((pattern) => wildcardToRegExp(pattern).test(url.href));

export const ruleMatchesUrl = (rule: Rule, value: string) => {
  const parsed = getUrlObject(value);
  if (!parsed) {
    return false;
  }

  return domainMatchesPattern(parsed.hostname, rule.domainPattern) && pathMatches(parsed.pathname, rule.pathPattern);
};

export const createLabelFromDomain = (domain: string) =>
  normalizeDomainPattern(domain)
    .split(".")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(".");
