import { permanentRedirect } from 'next/navigation';

/**
 * `/events/[id]` → `/experiences`, permanently (P5b decision 20).
 *
 * It redirects to the **list**, not to a slug. The old route addressed an
 * `Event` by uuid; the new one addresses the `Product` that sells places on it
 * by slug, and the public catalog offers no id→slug lookup that does not cost a
 * fetch on every hit of a legacy URL. Sending a visitor to the list, where the
 * sitting they wanted is the first thing they see, is both cheaper and honest
 * about the fact that the sitting may since have run.
 *
 * **Ownership note:** see `app/(public)/events/page.tsx` — Task 13 owns this
 * redirect; Task 7 writes it because it deletes the components this page used.
 */
export default function EventDetailRedirectPage(): never {
  permanentRedirect('/experiences');
}
