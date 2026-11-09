import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import InvoiceForm from "./invoice-form";

export default function NewInvoiceDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>New invoice</DialogTitle>
                    <DialogDescription>
                        Quote an advance against an invoice, then fund it.
                    </DialogDescription>
                </DialogHeader>
                <InvoiceForm />
            </DialogContent>
        </Dialog>
    );
}
