import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import App from './components/App';

createRoot(document.getElementById('app')).render(
    <TooltipProvider>
        <App />
    </TooltipProvider>,
);
