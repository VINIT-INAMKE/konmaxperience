/**
 * jest `globalTeardown` for the integration project. Set
 * `INTEGRATION_KEEP_DATA=true` to leave the rows behind for a post-mortem.
 */
import { globalTeardown } from './integration-setup';

export default globalTeardown;
