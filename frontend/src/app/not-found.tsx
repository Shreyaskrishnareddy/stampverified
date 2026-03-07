export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center px-4">
      <div className="text-center animate-fade-in max-w-md">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
          </svg>
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 mb-3">404</h1>
        <p className="text-lg text-slate-500 mb-8">This page doesn&apos;t exist or has been moved.</p>
        <a
          href="/"
          className="inline-flex items-center gap-2.5 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          Back to Stamp
        </a>
        <p className="mt-10 text-xs text-slate-400">
          <a href="/" className="font-semibold text-slate-500 hover:text-slate-900 transition-colors">stampverified.com</a>
        </p>
      </div>
    </div>
  );
}
