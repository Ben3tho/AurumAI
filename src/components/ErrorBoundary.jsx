import React from "react";

// AURUM AI — ErrorBoundary.
// Catches render-phase crashes and displays the actual error message + stack
// instead of a blank white screen, so the root cause is visible.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("AURUM ErrorBoundary caught:", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, info: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || String(this.state.error);
      const stack = this.state.error?.stack || "";
      const compStack = this.state.info?.componentStack || "";
      return (
        <div className="min-h-screen bg-[#0B0D11] text-aurum-text p-6 flex items-center justify-center">
          <div className="max-w-2xl w-full hairline rounded-lg bg-surface p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded bg-gold flex items-center justify-center font-display font-bold text-[#0B0D11]">A</div>
              <span className="font-display font-bold text-lg">AURUM AI — Render Error</span>
            </div>
            <p className="text-sm text-bear font-data mb-4 break-words">{msg}</p>
            {stack && (
              <details className="mb-3">
                <summary className="text-[0.75rem] text-aurum-text-secondary font-data cursor-pointer mb-1">Error stack</summary>
                <pre className="text-[0.6875rem] font-data text-aurum-text-secondary bg-surface-elevated p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap">{stack}</pre>
              </details>
            )}
            {compStack && (
              <details className="mb-3">
                <summary className="text-[0.75rem] text-aurum-text-secondary font-data cursor-pointer mb-1">Component stack</summary>
                <pre className="text-[0.6875rem] font-data text-aurum-text-secondary bg-surface-elevated p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap">{compStack}</pre>
              </details>
            )}
            <button onClick={this.handleReload} className="px-4 py-2 rounded-md bg-gold text-[#0B0D11] font-data font-bold text-sm hover:opacity-90">
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}