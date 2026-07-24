import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message:
        error instanceof Error
          ? error.message
          : 'An unexpected UI error interrupted the workspace.',
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application error boundary triggered', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_#f7f1e8_0%,_#e8dfd1_100%)] px-4 py-8 text-slate-950 dark:text-slate-50">
          <section className="surface-card max-w-xl space-y-4 px-8 py-8">
            <span className="section-kicker">Recovered safely</span>
            <h1 className="font-display text-3xl tracking-[-0.04em]">
              The PDF workspace hit an unexpected client-side error.
            </h1>
            <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">{this.state.message}</p>
            <button
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => window.location.reload()}
              type="button"
            >
              Reload workspace
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
