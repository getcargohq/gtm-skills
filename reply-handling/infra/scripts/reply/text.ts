// Text helpers the scripts share. Plain functions with no SDK import, so a
// script that imports them can still be bundled into a script node.

const newline = String.fromCharCode(10);
const emDash = String.fromCharCode(8212);
const enDash = String.fromCharCode(8211);

/** Replaces em and en dashes with commas, the most common tell of generated text. */
export const replaceDashes = (text: string): string => {
  let result = text;
  for (const dash of [emDash, enDash]) {
    result = result
      .split(" " + dash + " ")
      .join(", ")
      .split(dash)
      .join(", ");
  }
  return result;
};

/** True when the text carries an em or en dash. */
export const hasDash = (text: string): boolean => {
  return text.indexOf(emDash) >= 0 || text.indexOf(enDash) >= 0;
};

export const countWords = (text: string): number => {
  return text
    .split(newline)
    .join(" ")
    .split(" ")
    .filter((word) => word.length > 0).length;
};

const escapeHtml = (text: string): string => {
  return text
    .split("&")
    .join("&amp;")
    .split("<")
    .join("&lt;")
    .split(">")
    .join("&gt;");
};

/** Paragraphs on blank lines, line breaks inside them. Nothing else. */
export const toHtml = (text: string): string => {
  return text
    .split(newline + newline)
    .map((paragraph) => {
      return "<p>" + escapeHtml(paragraph).split(newline).join("<br>") + "</p>";
    })
    .join("");
};
