import { Loader2 } from 'lucide-react';

export default function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
      <Loader2 size={20} className="animate-spin text-muted" />
    </div>
  );
}
