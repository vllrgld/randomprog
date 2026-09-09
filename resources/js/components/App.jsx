import { useState } from 'react';

export default function App() {
    const [count, setCount] = useState(0);

    return (
        <main className="app">
            <section className="card">
                <h1>Laravel + React</h1>
                <p>Vite is compiling this React app. Tailwind has been removed.</p>
                <button type="button" onClick={() => setCount((value) => value + 1)}>
                    Clicked {count} {count === 1 ? 'time' : 'times'}
                </button>
            </section>
        </main>
    );
}
