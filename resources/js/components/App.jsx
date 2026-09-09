import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import DocumentsAttachment from './DocumentsAttachment';
import DocumentViewer from './DocumentViewer';
import Settings from './Settings';
import { listDocuments, formatFileSize } from '@/lib/documents';

function SidebarReopenTrigger() {
    const { open, isMobile } = useSidebar();

    if (!isMobile && open) {
        return null;
    }

    return <SidebarTrigger />;
}

export default function App() {
    const [page, setPage] = useState('home');
    const [attachments, setAttachments] = useState([]);
    const [listError, setListError] = useState(null);
    const [preview, setPreview] = useState(null);

    useEffect(() => {
        if (page !== 'documents') {
            setPreview(null);

            return;
        }

        let cancelled = false;

        listDocuments()
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
    }, [page]);

    return (
        <SidebarProvider>
            <AppSidebar activePage={page} onNavigate={setPage} />
            <SidebarInset>
                <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarReopenTrigger />
                    <h1 className="text-sm font-medium">
                        {page === 'home' ? 'Home' : page === 'documents' ? 'Documents' : 'Settings'}
                    </h1>
                    {page === 'documents' && (
                        <div className="ml-auto">
                            <DocumentsAttachment
                                onAttach={(document) =>
                                    setAttachments((current) => [document, ...current])
                                }
                            />
                        </div>
                    )}
                </header>

                <div className="flex flex-1 flex-col gap-4 p-6">
                    {page === 'settings' && <Settings />}
                    {page === 'documents' &&
                        (listError ? (
                            <p className="text-destructive">{listError}</p>
                        ) : attachments.length === 0 ? (
                            <p className="text-muted-foreground">No documents yet. Attach a file to get started.</p>
                        ) : (
                            <ul className="divide-y rounded-lg border">
                                {attachments.map((attachment) => (
                                    <li key={attachment.id} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                                        <Button
                                            variant="link"
                                            title={attachment.name}
                                            className="h-auto min-w-0 flex-1 justify-start px-0 text-foreground"
                                            onClick={() => setPreview(attachment)}
                                        >
                                            <span className="truncate">{attachment.name}</span>
                                        </Button>
                                        <span className="text-muted-foreground text-xs">
                                            {formatFileSize(attachment.size)}
                                            {attachment.compressed && attachment.original_size
                                                ? ` (was ${formatFileSize(attachment.original_size)})`
                                                : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ))}
                    {page === 'documents' ? <DocumentViewer document={preview} onClose={() => setPreview(null)} /> : null}
                </div>

                <footer className="border-t px-4 py-3 text-sm text-muted-foreground">
                    © 2026 Docs Playground
                </footer>
            </SidebarInset>
        </SidebarProvider>
    );
}
