/**
 * Escapes special regex characters so the string can be used safely in
 * `new RegExp(...)`.  Used by both the role classifier and job search.
 */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default escapeRegex;
