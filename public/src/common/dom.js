/**
 * @author [A likely boring stuff made by] Shevek
 * @desc dom.js — Création d'éléments. Tout texte venu de l'API passe par `textContent` ou par un nœud
 *       texte, jamais par `innerHTML`.
 */

/** Crée un élément, lui applique ses propriétés, y ajoute ses enfants ; les valeurs vides sont ignorées. */
export function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of children) {
    if (child === "" || child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

export function clear(node) {
  node.replaceChildren();
  return node;
}

export function debounce(fn, delay) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
