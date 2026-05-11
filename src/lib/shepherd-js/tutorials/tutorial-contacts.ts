import type { Tour } from "shepherd.js";

export function launchTutorialContacts(
  tour: Tour,
  completeTutorialFn?: () => void,
): void {
  const completeTutorial = (): void => {
    tour.complete();
    completeTutorialFn?.();
  };

  tour.addStep({
    id: "majik-message-contacts-welcome",
    title: "Welcome to Contacts!",
    text: "Your Contacts list stores trusted accounts. You must add someone here before you can encrypt messages to them or decrypt messages from them.",
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Next", action: tour.next },
    ],
  });

  tour.addStep({
    id: "majik-message-contacts-overview",
    title: "Contacts Overview",
    text: "This panel shows all saved contacts. Each contact represents a trusted public key you can securely message.",
    attachTo: { element: "#section-contacts", on: "left" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  tour.addStep({
    id: "majik-message-contacts-invite",
    title: "Manage Contact Invites",
    text: "Click here to view and manage your contact invites.",
    attachTo: { element: "#button-popup-contacts-invites", on: "bottom" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  tour.addStep({
    id: "majik-message-contacts-add",
    title: "Add a Contact",
    text: "Click here to add someone using their invite key.",
    attachTo: { element: "#button-popup-contacts-add", on: "bottom" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  tour.addStep({
    id: "majik-message-contacts-groups-overview",
    title: "Groups",
    text: "This is where you can see all your contact groups and organize people more efficiently.",
    attachTo: { element: "#section-contact-groups", on: "bottom" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  tour.addStep({
    id: "majik-message-contacts-groups-favorites",
    title: "Favorites Group",
    text: "The system includes a default group called 'Favorites' for quick access to important contacts.",
    attachTo: { element: "#button-contact-groups-item-0", on: "left" }, // adjust selector
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  tour.addStep({
    id: "majik-message-contacts-groups-manage",
    title: "Manage a Group",
    text: "Click a group to filter and view only the contacts inside it. Then click “Edit” to manage the group — rename it, update its photo, color, description, members, or delete it.",
    attachTo: { element: "#button-contact-groups-manage-0", on: "left" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  tour.addStep({
    id: "majik-message-contacts-groups-create",
    title: "Create a Group",
    text: "Click here to create a new group and better organize your contacts.",
    attachTo: { element: "#button-popup-contacts-create-group", on: "bottom" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  tour.addStep({
    id: "majik-message-contacts-invite-key",
    title: "Get Their Invite Key",
    text: "Ask your friend to open their Accounts panel and share their invite key with you. Paste it here to add them as a contact.",
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  tour.addStep({
    id: "majik-message-contacts-actions",
    title: "Manage Contacts",
    text: "Hover over a contact to rename or remove them from your list.",
    attachTo: { element: "#section-contacts", on: "left" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Finish Tour", action: completeTutorial },
    ],
  });
  tour.start();
}
