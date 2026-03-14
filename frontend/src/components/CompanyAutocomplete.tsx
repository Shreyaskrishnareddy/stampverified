"use client";
import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";

interface Company {
  name: string;
  domain: string;
  logo: string;
  onStamp?: boolean;
  orgId?: string;
}

interface Props {
  value: string;
  domain: string;
  onChange: (name: string, domain: string) => void;
  placeholder?: string;
}

function looksLikeDomain(q: string): boolean {
  return q.includes(".") && !q.includes(" ");
}

export default function CompanyAutocomplete({ value, domain, onChange, placeholder = "Enter company name or domain..." }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Company[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [domainMatch, setDomainMatch] = useState<Company | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const search = async (q: string) => {
    if (q.length < 2) { setResults([]); setDomainMatch(null); return; }
    setLoading(true);
    setDomainMatch(null);

    try {
      const isDomain = looksLikeDomain(q);

      // Always search Stamp orgs (supports both name and domain)
      const stampResults = await api.searchOrganizations(q).catch(() => []);

      // If it looks like a domain and we got an exact match, highlight it
      if (isDomain) {
        const exactMatch = (stampResults as { domain: string; name: string; id: string; logo_url?: string }[])
          .find(o => o.domain === q.trim().toLowerCase());
        if (exactMatch) {
          const match: Company = {
            name: exactMatch.name,
            domain: exactMatch.domain,
            logo: exactMatch.logo_url || `https://www.google.com/s2/favicons?sz=128&domain=${exactMatch.domain}`,
            onStamp: true,
            orgId: exactMatch.id,
          };
          setDomainMatch(match);
          setResults([]);
          setLoading(false);
          setIsOpen(true);
          return;
        }
      }

      // Also search Clearbit for name-based queries
      const clearbitResults = isDomain ? [] : await api.searchCompanies(q).catch(() => []);

      // Build results: Stamp orgs first, then Clearbit
      const stampDomains = new Set(stampResults.map((o: { domain: string }) => o.domain));
      const combined: Company[] = [];

      for (const org of stampResults) {
        combined.push({
          name: org.name,
          domain: org.domain,
          logo: org.logo_url || `https://www.google.com/s2/favicons?sz=128&domain=${org.domain}`,
          onStamp: true,
          orgId: org.id,
        });
      }

      for (const c of clearbitResults) {
        if (!stampDomains.has(c.domain)) {
          combined.push({
            name: c.name,
            domain: c.domain,
            logo: c.logo || `https://www.google.com/s2/favicons?sz=128&domain=${c.domain}`,
            onStamp: false,
          });
        }
      }

      setResults(combined.slice(0, 8));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (val: string) => {
    setQuery(val);
    onChange(val, "");
    setDomainMatch(null);
    setIsOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (company: Company) => {
    setQuery(company.name);
    onChange(company.name, company.domain);
    setIsOpen(false);
    setResults([]);
    setDomainMatch(null);
  };

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => (results.length > 0 || domainMatch) && setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
      />
      {domain && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{domain}</span>
      )}

      {isOpen && (domainMatch || results.length > 0 || loading) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto animate-slide-down">
          {loading && results.length === 0 && !domainMatch && (
            <div className="px-4 py-3 text-sm text-gray-400">Searching...</div>
          )}

          {/* Exact domain match — shown prominently */}
          {domainMatch && (
            <button
              onClick={() => handleSelect(domainMatch)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-amber-50/50 hover:bg-amber-50 transition-colors text-left border-b border-amber-100/50"
            >
              <img
                src={domainMatch.logo}
                alt=""
                className="w-8 h-8 rounded-md bg-white object-contain border border-gray-100"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-gray-900 truncate">{domainMatch.name}</span>
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="#C8A235"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                </div>
                <div className="text-xs text-gray-400">{domainMatch.domain}</div>
              </div>
            </button>
          )}

          {/* Regular search results */}
          {results.map((c, i) => (
            <button
              key={`${c.domain}-${i}`}
              onClick={() => handleSelect(c)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
            >
              <img
                src={c.logo}
                alt=""
                className="w-8 h-8 rounded-md bg-gray-100 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-900 truncate">{c.name}</span>
                  {c.onStamp && (
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="#C8A235"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                  )}
                </div>
                <div className="text-xs text-gray-400">{c.domain}</div>
              </div>
            </button>
          ))}

          {!loading && !domainMatch && query.length >= 2 && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">
              No matching companies found. Try searching by domain (e.g., stripe.com).
            </div>
          )}
        </div>
      )}
    </div>
  );
}
