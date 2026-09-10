import { useCallback, useEffect, useState } from 'react';
import { applyTheme, resolvedTheme, THEME_STORAGE_KEY } from '@/lib/theme';

export function useTheme() {
    const [theme, setThemeState] = useState(() => resolvedTheme());

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');

        const onChange = () => {
            if (localStorage.getItem(THEME_STORAGE_KEY) == null) {
                setThemeState(resolvedTheme());
            }
        };

        media.addEventListener('change', onChange);

        return () => media.removeEventListener('change', onChange);
    }, []);

    const setTheme = useCallback((next) => {
        localStorage.setItem(THEME_STORAGE_KEY, next);
        setThemeState(next);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    }, [setTheme, theme]);

    return { theme, setTheme, toggleTheme };
}
