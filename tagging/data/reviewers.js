/* Canonical reviewer names for the tagging app.
   A reviewer is never free-typed: the select in index.html is built from this
   list, so "Johan" can never end up as "johan", "Jonah" or "J." in the Tags tab.
   Source: fcg-data.json coach registry + the W13 week workbook Club tab
   (Head coach / Assistent columns, sheet nfs4fg). The Club tab abbreviates
   Tigran as "Ti"; FCG_REVIEWER_ALIASES folds that spelling into the full name.
   Add a coach here, not in the form. */
window.FCG_REVIEWERS = [
  "Easy",
  "Johan",
  "Lance",
  "Luka",
  "Mia",
  "Nikola",
  "Rash",
  "Relax",
  "Rico",
  "Roger",
  "Ruan",
  "Tigran"
];

window.FCG_REVIEWER_ALIASES = {
  "ti": "Tigran"
};
