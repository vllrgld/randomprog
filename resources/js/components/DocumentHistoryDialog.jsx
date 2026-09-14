import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';

export default function DocumentHistoryDialog({ document: file, open, onOpenChange }) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>Document history</SheetTitle>
                    <SheetDescription>
                        Previous versions of {file?.name ?? 'this document'} will appear here.
                    </SheetDescription>
                </SheetHeader>
                <p className="text-muted-foreground px-4 text-sm">No history yet.</p>
            </SheetContent>
        </Sheet>
    );
}
