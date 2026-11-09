import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import LoanForm from "./loan-form";

export default function NewLoanDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>New term loan</DialogTitle>
                    <DialogDescription>
                        Get a quote, check the schedule, then approve it to disburse.
                    </DialogDescription>
                </DialogHeader>
                <LoanForm />
            </DialogContent>
        </Dialog>
    );
}
