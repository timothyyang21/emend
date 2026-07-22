/**
 * THE SEED DOCUMENT — James's sample passage, verbatim.
 *
 * Single source of truth. The editor's first launch, the server's initial GET,
 * the demo, and any reset all read THIS constant — nothing re-types the prose.
 *
 * Do not "improve" this text. It is someone's writing sample, it is what the
 * demo is judged on, and it is deliberately full of things that make an edit
 * pipeline work for its living:
 *   - "Susan" twice and "Thomas" twice, plus the possessive "Thomas's", so a
 *     rename has to handle the apostrophe form without dragging it in
 *   - "Thomas-no ... that-dashing": hyphenated interruptions that a careless
 *     model will silently normalise to em dashes, which would then show up as
 *     changes the writer never asked for
 *   - a one-line paragraph between two long ones, so paragraph-index reasoning
 *     has somewhere to go wrong
 *
 * Line wrapping is not part of the prose: each paragraph is one line, separated
 * by a blank line. Hard-wrapping mid-paragraph would make any reflow show up as
 * diff noise in the review surface.
 */
export const SAMPLE_MARKDOWN = `The forest behind their house in upstate New York was Thomas's kingdom. He'd spent every summer day of his short life exploring its trails, cataloging its wildlife, building forts from fallen branches. When the car took him at the corner of Maple and Vine, Susan couldn't bear to look at the trees.

They were too full of her son.

For a year, the forest stood silent and empty. Then one spring morning, Susan heard the familiar patter of small feet running down the trailhead. She looked out the kitchen window and saw Thomas-no, she still couldn't bring herself to call him that-dashing into the woods with a net and a mason jar.
`;
