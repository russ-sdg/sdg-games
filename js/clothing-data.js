// The clothing shown on the home page (the shop itself is on Printify). Add an entry, and its picture to Home/tools/build-home-art.py.
//   art   assets/home/<art>.webp, artSize is its [width, height]
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SDGClothing = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SHOP = 'https://sdg-soft-wear.printify.me/';
  const CLOTHING = [
    { title: 'Be Kind (Ephesians 4:32)', url: SHOP + 'product/13560869/be-kind-ephesians-432-heavy-cotton-tee', art: 'shirt-be-kind', artSize: [357, 315], artAlt: 'The Be Kind (Ephesians 4:32) T-shirt',
      blurb: 'Be kind to one another, tender hearted, forgiving each other, just as God also in Christ forgave you.', featured: true },
    { title: 'Gracious Words (Proverbs 16:24)', url: SHOP + 'product/7578539/proverbs-1624-heavy-cotton-tee', art: 'shirt-gracious-words', artSize: [359, 325], artAlt: 'The Gracious Words (Proverbs 16:24) T-shirt',
      blurb: 'Gracious words are like a honeycomb, sweet to the soul, health to the bones.', featured: true },
    { title: 'Five Solas', url: SHOP + 'product/7566867/sola-softstyle-t-shirt', art: 'shirt-five-solas', artSize: [345, 345], artAlt: 'The Five Solas T-shirt',
      blurb: 'All glory to God! Salvation by grace, through faith, in Christ, according to Scripture alone.', featured: true },
  ];
  return { SHOP, CLOTHING };
});
