document.addEventListener("click", (e) => { window.__clicks = (window.__clicks || []).concat([e.constructor.name + ":" + e.pointerType]); }, true);
