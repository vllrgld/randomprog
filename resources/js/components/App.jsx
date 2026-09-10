import { useEffect, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import DocumentsAttachment from './DocumentsAttachment';
import DocumentViewer from './DocumentViewer';
import LoginPage from '@/pages/login';
import Settings from './Settings';
import ThemeToggle from './ThemeToggle';
import { deleteDocument, listDocuments, formatFileSize } from '@/lib/documents';
import { docTypeLabel } from '@/lib/doc-types';

function SidebarReopenTrigger() {
    const { open, isMobile } = useSidebar();

    if (!isMobile && open) {
        return null;
    }

    return <SidebarTrigger />;
}

export default function App() {
    const [authenticated, setAuthenticated] = useState(false);

    if (!authenticated) {
        return <LoginPage onLogin={() => setAuthenticated(true)} />;
    }

    return <Dashboard onLogout={() => setAuthenticated(false)} />;
}

function Dashboard({ onLogout }) {
    const [page, setPage] = useState('home');
    const [attachments, setAttachments] = useState([]);
    const [listError, setListError] = useState(null);
    const [preview, setPreview] = useState(null);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [pendingDelete, setPendingDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState(null);

    useEffect(() => {
        const timeout = setTimeout(() => setSearch(searchInput.trim()), 300);

        return () => clearTimeout(timeout);
    }, [searchInput]);

    useEffect(() => {
        if (page !== 'documents') {
            setPreview(null);

            return;
        }

        let cancelled = false;

        listDocuments(search)
            .then((documents) => {
                if (!cancelled) {
                    setAttachments(documents);
                    setListError(null);
                }
            })
            .catch((caught) => {
                if (!cancelled) {
                    setListError(caught instanceof Error ? caught.message : 'Could not load documents.');
                }
            });

        return () => {
            cancelled = true;
        };
    }, [page, search]);

    async function confirmDelete() {
        if (!pendingDelete || deleting) {
            return;
        }

        setDeleting(true);n
        setDeleteError(null);

        try {
            await deleteDocument(pendingDelete.id);
            setAttachments((current) => current.filter((attachment) => attachment.id !== pendingDelete.id));
            setPreview((current) => (current?.id === pendingDelete.id ? null : current));
            setPendingDelete(null);
        } catch (caught) {
            setDeleteError(caught instanceof Error ? caught.message : 'Could not delete the document.');
        } finally {
            setDeleting(false);
        }
    }

    return (
        <SidebarProvider>
            <AppSidebar activePage={page} onNavigate={setPage} onLogout={onLogout} />
            <SidebarInset>
                <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarReopenTrigger />
                    <h1 className="shrink-0 text-sm font-medium">
                        {page === 'home' ? 'Home' : page === 'documents' ? 'Documents' : 'Settings'}
                    </h1>
                    {page === 'documents' && (
                        <>
                            <div className="flex min-w-0 flex-1 justify-center px-2">
                                <div className="relative w-full max-w-xs">
                                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        value={searchInput}
                                        onChange={(event) => setSearchInput(event.target.value)}
                                        placeholder="Search OCR text…"
                                        aria-label="Search OCR text"
                                        className="pl-8"
                                    />
                                </div>
                            </div>
                            <div className="shrink-0">
                                <DocumentsAttachment
                                    onAttach={(document) => {
                                        setAttachments((current) => [document, ...current]);
                                        setPreview(document);
                                    }}
                                />
                            </div>
                        </>
                    )}
                </header>

                <div className="flex flex-1 flex-col gap-4 p-6">
                    {page === 'settings' && <Settings />}
                    {page === 'documents' &&
                        (listError ? (
                            <p className="text-destructive">{listError}</p>
                        ) : attachments.length === 0 ? (
                            <p className="text-muted-foreground">
                                {search
                                    ? 'No documents match that OCR text.'
                                    : 'No documents yet. Attach a file to get started.'}
                            </p>
                        ) : (
                            <ul className="divide-y rounded-lg border">
                                {attachments.map((attachment) => (
                                    <li key={attachment.id} className="flex items-start justify-between gap-4 px-3 py-2 text-sm">
                                        <div className="min-w-0 flex-1">
                                            <Button
                                                variant="link"
                                                title={attachment.name}
                                                className="h-auto w-full justify-start px-0 text-foreground"
                                                onClick={() => setPreview(attachment)}
                                            >
                                                <span className="truncate">{attachment.name}</span>
                                            </Button>
                                            {attachment.ocr_snippet ? (
                                                <p className="text-muted-foreground line-clamp-2 text-xs">{attachment.ocr_snippet}</p>
                                            ) : null}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1 pt-0.5">
                                            <span className="text-muted-foreground text-xs">
                                                {docTypeLabel(attachment.doc_type)}
                                                {' · '}
                                                {formatFileSize(attachment.size)}
                                                {attachment.compressed && attachment.original_size
                                                    ? ` (was ${formatFileSize(attachment.original_size)})`
                                                    : ''}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                title="Delete"
                                                aria-label={`Delete ${attachment.name}`}
                                                className="text-muted-foreground hover:text-destructive"
                                                onClick={() => {
                                                    setDeleteError(null);
                                                    setPendingDelete(attachment);
                                                }}
                                            >
                                                <Trash2 />
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ))}
                    {page === 'documents' ? (
                        <DocumentViewer
                            document={preview}
                            onClose={() => setPreview(null)}
                            onDocumentChange={(document) => {
                                setPreview(document);
                                setAttachments((current) =>
                                    current.map((attachment) =>
                                        attachment.id === document.id ? { ...attachment, ...document } : attachment,
                                    ),
                                );
                            }}
                        />
                    ) : null}
                    <Dialog
                        open={pendingDelete != null}
                        onOpenChange={(open) => {
                            if (deleting) {
                                return;
                            }

                            if (!open) {
                                setPendingDelete(null);
                                setDeleteError(null);
                            }
                        }}
                    >
                        <DialogContent showCloseButton={!deleting} className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Delete document</DialogTitle>
                                <DialogDescription>
                                    This removes the file, OCR text, and related info for{' '}
                                    {pendingDelete?.name ?? 'this document'}.
                                </DialogDescription>
                            </DialogHeader>
                            {deleteError ? <p className="text-destructive text-xs">{deleteError}</p> : null}
                            <DialogFooter>
                                <DialogClose render={<Button variant="outline" disabled={deleting} />}>Cancel</DialogClose>
                                <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>
                                    {deleting ? 'Deleting…' : 'Delete'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <footer className="mt-auto flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
                    <span>© 2026 Docs Playground</span>
                    <ThemeToggle />
                </footer>
            </SidebarInset>
        </SidebarProvider>
    );
}
