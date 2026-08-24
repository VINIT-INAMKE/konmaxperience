/**
 * `POST /evidence/:id/review-assist` takes nothing but the id in the path — the
 * suggestion is derived entirely from stored state, so there is no knob a caller
 * could turn that would not also be a way to steer the answer.
 *
 * The class is declared (and bound with `@Body()`) rather than omitted because
 * the global `ValidationPipe` runs with `forbidNonWhitelisted: true`: with a DTO
 * in place a stray payload is a 400 that says so, instead of being silently
 * dropped and leaving the caller believing it was honoured.
 */
export class RequestAssistDto {}
