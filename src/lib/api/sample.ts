/**
 * The manuscript the app opens with, so the very first thing a reviewer sees is
 * real prose rather than an empty box.
 *
 * Chosen to exercise both halves of the edit pipeline in one demo:
 *  - "Susan" appears four times, twice possessive, once inside "Susannah" —
 *    so "replace Susan with Janet" has a near-substring trap in it.
 *  - The opening paragraph is deliberately mild, so "make the opening more
 *    ominous" has somewhere to go.
 */
export const SAMPLE_MARKDOWN = `# The Long Gallery

The rain had stopped by four, and Susan walked out along the terrace while the
light was still good. The gravel was wet and the yew hedges dripped, and beyond
them the lawn ran down to the lake in a single unbroken green.

She had not expected the house to be so quiet. Susan's aunt had written of
company, of a full table every evening, but the long gallery held nothing but
portraits and the smell of cold ash.

At the far end a door stood open that had been shut all week. Susannah Vane —
her cousin, and no relation she had ever been glad of — was standing in it with
her gloves already on.

"You are wanted," she said. "Susan's things have been moved to the east wing."
`;
