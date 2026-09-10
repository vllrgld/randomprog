import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/hooks/use-theme';

export default function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <div className="flex items-center gap-2">
            <Sun className={cn('size-3.5', isDark ? 'text-muted-foreground' : 'text-foreground')} aria-hidden />
            <Switch
                checked={isDark}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
            <Moon className={cn('size-3.5', isDark ? 'text-foreground' : 'text-muted-foreground')} aria-hidden />
        </div>
    );
}
