export default function PlaygroundIcon({ className, ...props }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden
            {...props}
        >
            <path d="M3 21h18" />
            <path d="M7 21V8h7" />
            <path d="M7 12h5" />
            <path d="M7 15h5" />
            <path d="M7 18h5" />
            <path d="M14 8h4v3l4 10" />
            <circle cx="16" cy="5" r="1.5" fill="currentColor" stroke="none" />
        </svg>
    );
}
