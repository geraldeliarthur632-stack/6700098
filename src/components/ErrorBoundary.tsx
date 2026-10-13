import * as React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorInfo: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorInfo: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let displayMessage = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(this.state.errorInfo || "{}");
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          displayMessage = "Você não tem permissão para realizar esta ação ou acessar estes dados.";
        }
      } catch (e) {
        // Not JSON
      }

      return (
        <div className="flex h-screen flex-col items-center justify-center bg-zinc-50 p-6 text-center">
          <div className="mb-6 rounded-3xl bg-red-50 p-6 text-red-500">
            <h2 className="text-xl font-bold mb-2">Ops! Algo deu errado.</h2>
            <p className="text-sm opacity-80">{displayMessage}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="rounded-2xl bg-zinc-900 px-8 py-3 font-bold text-white shadow-lg active:scale-95"
          >
            Recarregar App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
