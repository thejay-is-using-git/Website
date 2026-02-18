(() => {
  const head = document.head;
  if (!head) {
    return;
  }

  function upsertMeta(selector, attrName, attrValue, content) {
    let node = head.querySelector(selector);
    if (!node) {
      node = document.createElement("meta");
      node.setAttribute(attrName, attrValue);
      head.appendChild(node);
    }
    if (!node.getAttribute("content")) {
      node.setAttribute("content", content);
    }
  }

  function upsertLinkCanonical(href) {
    let node = head.querySelector("link[rel='canonical']");
    if (!node) {
      node = document.createElement("link");
      node.setAttribute("rel", "canonical");
      head.appendChild(node);
    }
    if (!node.getAttribute("href")) {
      node.setAttribute("href", href);
    }
  }

  const path = (window.location.pathname || "").toLowerCase();
  const pageUrl = window.location.href.split("#")[0];
  const base = `${window.location.origin}/Website`;

  const defaults = {
    title: "CTRL_J - Home",
    description: "Bienvenue sur le site de CTRL_J: modding, publications, mises a jour et ressources.",
    image: `${base}/assets/images/Background.jpg`
  };

  if (path.includes("resources.html")) {
    defaults.title = "CTRL_J - Resources";
    defaults.description = "Retrouve les ressources de CTRL_J: liens utiles, publications, modding et communautes.";
    defaults.image = `${base}/assets/images/CTRL_J.png`;
  } else if (path.includes("credit.html")) {
    defaults.title = "CTRL_J - Credit";
    defaults.description = "Credits du site CTRL_J et informations sur la creation du projet.";
    defaults.image = `${base}/assets/images/CTRL_J.png`;
  }

  upsertLinkCanonical(pageUrl);

  upsertMeta("meta[name='description']", "name", "description", defaults.description);
  upsertMeta("meta[property='og:type']", "property", "og:type", "website");
  upsertMeta("meta[property='og:site_name']", "property", "og:site_name", "CTRL_J Website");
  upsertMeta("meta[property='og:locale']", "property", "og:locale", "fr_FR");
  upsertMeta("meta[property='og:title']", "property", "og:title", defaults.title);
  upsertMeta("meta[property='og:description']", "property", "og:description", defaults.description);
  upsertMeta("meta[property='og:url']", "property", "og:url", pageUrl);
  upsertMeta("meta[property='og:image']", "property", "og:image", defaults.image);
  upsertMeta("meta[name='twitter:card']", "name", "twitter:card", "summary_large_image");
  upsertMeta("meta[name='twitter:title']", "name", "twitter:title", defaults.title);
  upsertMeta("meta[name='twitter:description']", "name", "twitter:description", defaults.description);
  upsertMeta("meta[name='twitter:image']", "name", "twitter:image", defaults.image);
})();
