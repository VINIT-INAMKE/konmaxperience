import { permanentRedirect } from 'next/navigation';

/**
 * `/events` → `/experiences`, permanently (SPEC §5.1, P5b decision 20).
 *
 * The storefront's experience surface moved: an experience is a `Product` of
 * type `experience` addressed by **slug**, not an `Event` addressed by id, and
 * `/experiences` is the route that sells it. The frozen homepage still links
 * here (`app/page.tsx:85,147,274`), so the path has to keep answering.
 *
 * A `308` rather than a `302` because the move is not coming back and the link
 * equity belongs at the new address.
 *
 * **Ownership note:** Task 13 owns this redirect. It is written here because
 * Task 7 deletes the four `components/public/Event*` components this page was
 * built from, and a repository that does not compile between two tasks is not a
 * repository anyone can bisect.
 */
export default function EventsRedirectPage(): never {
  permanentRedirect('/experiences');
}
