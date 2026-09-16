export default function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 font-medium underline underline-offset-2 hover:text-red-800">
          Retry
        </button>
      )}
    </div>
  );
}
