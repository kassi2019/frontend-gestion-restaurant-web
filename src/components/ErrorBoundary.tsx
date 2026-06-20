import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('❌ ErrorBoundary:', error.message, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center animate-slideUp">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-extrabold text-gray-800 mb-2">Oups, une erreur est survenue</h1>
            <p className="text-sm text-gray-500 mb-6">
              La page a rencontré une erreur inattendue. Essayez de recharger.
            </p>
            <details className="text-left mb-6">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Détails techniques</summary>
              <pre className="mt-2 text-xs text-red-500 bg-red-50 rounded-xl p-3 overflow-auto max-h-32">
                {this.state.error?.message || 'Erreur inconnue'}
              </pre>
            </details>
            <button
              onClick={this.handleReload}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold cursor-pointer hover:bg-orange-600 transition-colors"
            >
              🔄 Recharger la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
