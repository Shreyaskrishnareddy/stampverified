"use client";
import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";

interface University {
  name: string;
  domain: string;
  country: string;
}

interface Props {
  value: string;
  domain: string;
  onChange: (name: string, domain: string) => void;
  placeholder?: string;
}

export default function UniversityAutocomplete({ value, domain, onChange, placeholder = "Search university..." }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<University[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => { setQuery(value); }, [value]);

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
      const data = await api.searchUniversities(q);
      setResults(data.slice(0, 8));
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

  const handleSelect = (uni: University) => {
    setQuery(uni.name);
    onChange(uni.name, uni.domain);
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

      {isOpen && (results.length > 0 || loading) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto animate-slide-down">
          {loading && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">Searching...</div>
          )}
          {results.map((u, i) => (
            <button
              key={`${u.domain}-${i}`}
              onClick={() => handleSelect(u)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{u.name}</div>
                <div className="text-xs text-gray-400">{u.country}</div>
              </div>
            </button>
          ))}
          {!loading && query.length >= 2 && (
            <div className="border-t border-gray-100 px-4 py-2.5">
              <button
                onClick={() => { onChange(query, ""); setIsOpen(false); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Use &quot;{query}&quot; as entered
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
