import { screen, waitFor, within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

type User = ReturnType<typeof userEvent.setup>;

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

// Opens the calendar, chooses the year and month in its dropdowns, then clicks the day
export const pickDate = async (user: User, label: string, iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    await user.click(screen.getByLabelText(label));

    const calendar = await waitFor(() => {
        const popover = document.querySelector<HTMLElement>(
            '[data-slot="popover-content"]'
        );
        if (!popover) throw new Error("calendar is not open");
        return popover;
    });
    const [monthSelect, yearSelect] = within(calendar).getAllByRole("combobox");
    await user.selectOptions(yearSelect!, String(year));
    await user.selectOptions(monthSelect!, String(month! - 1));

    const name = new RegExp(`${MONTHS[month! - 1]} ${day}(st|nd|rd|th), ${year}`);
    await user.click(within(calendar).getByRole("button", { name }));
};

// Picks a preset or types a custom value into a react-select and confirms it with Enter
export const chooseOption = async (user: User, label: string, text: string) => {
    const input = screen.getByRole("combobox", { name: label });
    await user.click(input);
    await user.type(input, `${text}{Enter}`);
};
