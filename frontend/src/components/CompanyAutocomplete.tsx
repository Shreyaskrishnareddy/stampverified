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

export default function CompanyAutocomplete({ value, domain, onChange, placeholder = "Search company..." }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Company[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);

    try {
      // Search both Clearbit and registered Stamp orgs in parallel
      const [clearbitResults, stampResults] = await Promise.all([
        api.searchCompanies(q).catch(() => []),
        api.searchOrganizations(q).catch(() => []),
      ]);

      // Build results: Stamp orgs first (marked), then Clearbit
      const stampDomains = new Set(stampResults.map((o: { domain: string }) => o.domain));
      const combined: Company[] = [];

      // Add Stamp orgs first
      for (const org of stampResults) {
        combined.push({
          name: org.name,
          domain: org.domain,
          logo: org.logo_url || `https://www.google.com/s2/favicons?sz=128&domain=${org.domain}`,
          onStamp: true,
          orgId: org.id,
        });
      }

      // Add Clearbit results that aren't already from Stamp
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
    setIsOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (company: Company) => {
    setQuery(company.name);
    onChange(company.name, company.domain);
    setIsOpen(false);
    setResults([]);
  };

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
      />
      {domain && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{domain}</span>
      )}

      {isOpen && (results.length > 0 || loading) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto animate-slide-down">
          {loading && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">Searching...</div>
          )}
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
                <div className="text-sm font-medium text-gray-900 truncate">{c.name}</div>
                <div className="text-xs text-gray-400">{c.domain}</div>
              </div>
              {c.onStamp && (
                <span className="flex-shrink-0 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  On Stamp
                </span>
              )}
            </button>
          ))}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="border-t border-gray-100 px-4 py-2.5">
              <p className="text-sm text-gray-400">
                No matching companies found. Only companies in our directory can be added.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
